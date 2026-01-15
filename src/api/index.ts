import createClient from 'openapi-fetch'
import { paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { SandboxInfo, SandboxMetrics, SandboxQuery, ObjectStorageConfig, PortConfig, LocalityConfig, SandboxRegion } from '../sandbox/types'

/**
 * 键名转换函数 - 前端 camelCase 与后端 snake_case 的双向转换
 */

// camelCase 转 snake_case (前端 -> 后端)
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

// snake_case 转 camelCase (后端 -> 前端)  
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// 递归转换对象键名：camelCase -> snake_case
function convertKeysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase)
  }
  
  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key)
      // 对于嵌套对象，只转换键名，不转换值（特别是环境变量的值）
      if (key === 'metadata' || key === 'envVars' || key === 'env_vars') {
        converted[snakeKey] = value // 保持原始的键值对
      } else {
        converted[snakeKey] = convertKeysToSnakeCase(value)
      }
    }
    return converted
  }
  
  return obj
}

// 递归转换对象键名：snake_case -> camelCase
function convertKeysToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase)
  }
  
  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key)
      converted[camelKey] = convertKeysToCamelCase(value)
    }
    return converted
  }
  
  return obj
}

/**
 * HTTP API 客户端
 * 基于 OpenAPI 规范，提供类型安全的 API 调用
 */
export class ApiClient {
  private client: ReturnType<typeof createClient<paths>>
  private config: ConnectionConfig
  private sandboxId?: string

  constructor(config: ConnectionConfig, sandboxId?: string) {
    this.config = config
    this.sandboxId = sandboxId
    
    // 标准鉴权方式：API Key 使用 X-API-KEY，Access Token 使用 Authorization Bearer
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (config.apiKey) {
      headers['X-API-KEY'] = config.apiKey
    } else if (config.accessToken) {
      headers['Authorization'] = `Bearer ${config.accessToken}`
    }
    
    // Add X-Debug header when debug mode is enabled
    // This triggers distributed tracing on the backend (Jaeger)
    if (config.debug) {
      headers['X-Debug'] = 'true'
    }
    
    this.client = createClient<paths>({
      baseUrl: config.apiUrl,
      headers
    })
  }

  /**
   * 处理API响应 - 将后端的 snake_case 转换为前端的 camelCase
   */
  private processResponse<T>(response: any): T {
    if (response.error) {
      throw new Error(`API Error: ${JSON.stringify(response.error)}`)
    }
    
    // 转换响应数据的键名
    if (response.data) {
      response.data = convertKeysToCamelCase(response.data)
    }
    
    return response as T
  }

  /**
   * 创建沙箱 - 兼容接口，内部转换为后端格式
   */
  async createSandbox(request: {
    // 标准 camelCase 参数
    template?: string
    timeout?: number
    metadata?: Record<string, string>
    envVars?: Record<string, string>
    allowInternetAccess?: boolean
    secure?: boolean
    autoPause?: boolean
    // 扩展参数
    name?: string
    description?: string
    projectId?: string
    cpuCount?: number
    memoryMB?: number
    storageGB?: number
    isAsync?: boolean
    // 对象存储配置
    objectStorage?: ObjectStorageConfig
    // 自定义端口
    customPorts?: PortConfig[]
    // 网络代理国家
    netProxyCountry?: 'united-states' | 'canada' | 'japan' | 'malaysia' | 'brazil' | 'france' | 'italy' | 'china' | 'hong-kong'
    // Locality preferences for scheduling
    locality?: LocalityConfig
  }): Promise<SandboxInfo> {
    // 使用通用转换函数将 camelCase 转换为后端期望的 snake_case
    const backendRequest = convertKeysToSnakeCase({
      name: request.name,
      description: request.description,
      template: request.template || 'base', // 默认使用 base 模板
      projectId: request.projectId,
      cpuCount: request.cpuCount,
      memoryMb: request.memoryMB, // 注意：这里是 memoryMb 不是 memoryMB
      storageGb: request.storageGB, // 注意：这里是 storageGb 不是 storageGB
      metadata: request.metadata,
      timeout: request.timeout || 300, // timeout in seconds, default 5 minutes
      envVars: request.envVars, // 将转换为 env_vars
      secure: request.secure ?? true, // 默认启用安全
      allowInternetAccess: request.allowInternetAccess ?? true, // 将转换为 allow_internet_access
      isAsync: request.isAsync ?? false, // 将转换为 is_async，默认同步
      objectStorage: request.objectStorage, // 将转换为 object_storage
      customPorts: request.customPorts, // 将转换为 custom_ports
      netProxyCountry: request.netProxyCountry, // 将转换为 net_proxy_country
      locality: request.locality // 将转换为 locality (nested object, keys will be converted)
    })
    
    const response = await this.client.POST('/v1/sandboxes', {
      body: backendRequest
    })

    if (response.error) {
      throw new Error(`Failed to create sandbox: ${JSON.stringify(response.error)}`)
    }

    // 处理响应，将 snake_case 转换为 camelCase
    const processedResponse = this.processResponse(response) as any
    const sandboxData = processedResponse.data?.data
    
    if (!sandboxData) {
      throw new Error('Invalid response: missing sandbox data')
    }
    
    // 由于 processResponse 已经转换了键名，这里直接使用 camelCase 字段
    // Calculate endAt: prefer timeoutAt from backend, fallback to startedAt + timeout calculation
    // Note: Backend always returns timeout in seconds, so we convert to ms for date calculation
    const sandboxStartedAt = sandboxData.startedAt ? new Date(sandboxData.startedAt) : new Date()
    const sandboxEndAt = sandboxData.timeoutAt 
      ? new Date(sandboxData.timeoutAt)
      : new Date(sandboxStartedAt.getTime() + sandboxData.timeout * 1000)
    
    return {
      // 标准字段
      sandboxId: sandboxData.sandboxId || '',
      templateId: sandboxData.templateId || '',
      name: sandboxData.name || '',
      metadata: sandboxData.metadata || {},
      startedAt: sandboxStartedAt,
      endAt: sandboxEndAt,
      status: sandboxData.status || 'created',
      cpuCount: sandboxData.cpuCount || 1,
      memoryMB: sandboxData.memoryMb || 512,
      envdVersion: '1.0.0',
      envs: sandboxData.envVars || {},
      
      // Scalebox扩展字段
      templateName: sandboxData.templateName,
      sandboxDomain: sandboxData.sandboxDomain,
      timeout: sandboxData.timeout,
      uptime: sandboxData.uptime || 0,
      
      // Lifecycle management fields
      substatus: sandboxData.substatus,
      reason: sandboxData.reason,
      stoppedAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : undefined,
      timeoutAt: sandboxData.timeoutAt ? new Date(sandboxData.timeoutAt) : undefined,
      endedAt: sandboxData.endedAt ? new Date(sandboxData.endedAt) : undefined,
      createdAt: sandboxData.createdAt ? new Date(sandboxData.createdAt) : new Date(),
      updatedAt: sandboxData.updatedAt ? new Date(sandboxData.updatedAt) : new Date(),
      
      // Pause/Resume tracking fields
      pausedAt: sandboxData.pausedAt ? new Date(sandboxData.pausedAt) : undefined,
      resumedAt: sandboxData.resumedAt ? new Date(sandboxData.resumedAt) : undefined,
      pauseTimeoutAt: sandboxData.pauseTimeoutAt ? new Date(sandboxData.pauseTimeoutAt) : undefined,
      totalPausedSeconds: sandboxData.totalPausedSeconds,
      
      // Kubernetes deployment information
      clusterId: sandboxData.clusterId,
      namespaceId: sandboxData.namespaceId,
      podName: sandboxData.podName,
      podUid: sandboxData.podUid,
      podIp: sandboxData.podIp,
      nodeName: sandboxData.nodeName,
      containerName: sandboxData.containerName,
      allocationTime: sandboxData.allocationTime ? new Date(sandboxData.allocationTime) : undefined,
      lastPodStatus: sandboxData.lastPodStatus,
      
      // State management information
      deletionInProgress: sandboxData.deletionInProgress || false,
      
      // Access token
      envdAccessToken: sandboxData.envdAccessToken,
      
      // Resource and cost information
      resources: sandboxData.resources || {
        cpu: sandboxData.cpuCount || 1,
        memory: sandboxData.memoryMb || 512,
        storage: sandboxData.storageGb || 0,
        bandwidth: 0
      },
      cost: sandboxData.cost || {
        hourlyRate: 0.0,
        totalCost: 0.0
      },
      
      // Owner information
      owner: sandboxData.owner,
      ownerUserId: sandboxData.ownerUserId,
      projectId: sandboxData.projectId,
      projectName: sandboxData.projectName,
      
      // Object storage information (only uri and mountPoint are returned, credentials are not included for security)
      objectStorage: sandboxData.objectStorage ? {
        uri: sandboxData.objectStorage.uri,
        mountPoint: sandboxData.objectStorage.mountPoint
      } : undefined,
      
      // Port configuration
      ports: sandboxData.ports || [],
      templatePorts: sandboxData.templatePorts || sandboxData.template_ports || [],
      customPorts: sandboxData.customPorts || sandboxData.custom_ports || [],
      
      // Network proxy configuration
      netProxyCountry: sandboxData.netProxyCountry
    }
  }

  /**
   * Get sandbox information - using correct path parameters and field conversion
   */
  async getSandbox(sandboxId: string): Promise<SandboxInfo> {
    const response = await this.client.GET('/v1/sandboxes/{sandbox_id}', {
      params: { path: { sandbox_id: sandboxId } }
    })

    if (response.error) {
      throw new Error(`Failed to get sandbox: ${JSON.stringify(response.error)}`)
    }

    // 处理响应，将 snake_case 转换为 camelCase
    const processedResponse = this.processResponse(response) as any
    const sandboxData = processedResponse.data?.data
    
    if (!sandboxData) {
      throw new Error('Invalid response: missing sandbox data')
    }
    
    // processResponse 已经转换了键名，直接使用 camelCase 字段
    // Calculate endAt: prefer timeoutAt from backend, fallback to startedAt + timeout calculation
    // Note: Backend always returns timeout in seconds, so we convert to ms for date calculation
    const sandboxStartedAt = sandboxData.startedAt ? new Date(sandboxData.startedAt) : new Date()
    const sandboxEndAt = sandboxData.timeoutAt 
      ? new Date(sandboxData.timeoutAt)
      : new Date(sandboxStartedAt.getTime() + sandboxData.timeout * 1000)
    
    return {
      // 标准字段
      sandboxId: sandboxData.sandboxId || '',
      templateId: sandboxData.templateId || '',
      name: sandboxData.name || '',
      metadata: sandboxData.metadata || {},
      startedAt: sandboxStartedAt,
      endAt: sandboxEndAt,
      status: sandboxData.status || 'created',
      cpuCount: sandboxData.cpuCount || 1,
      memoryMB: sandboxData.memoryMb || 512,
      envdVersion: '1.0.0',
      envs: sandboxData.envVars || {},
      
      // Scalebox扩展字段
      templateName: sandboxData.templateName,
      sandboxDomain: sandboxData.sandboxDomain,
      timeout: sandboxData.timeout,
      uptime: sandboxData.uptime || 0,
      
      // Lifecycle management fields
      substatus: sandboxData.substatus,
      reason: sandboxData.reason,
      stoppedAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : undefined,
      timeoutAt: sandboxData.timeoutAt ? new Date(sandboxData.timeoutAt) : undefined,
      endedAt: sandboxData.endedAt ? new Date(sandboxData.endedAt) : undefined,
      createdAt: sandboxData.createdAt ? new Date(sandboxData.createdAt) : new Date(),
      updatedAt: sandboxData.updatedAt ? new Date(sandboxData.updatedAt) : new Date(),
      
      // Pause/Resume tracking fields
      pausedAt: sandboxData.pausedAt ? new Date(sandboxData.pausedAt) : undefined,
      resumedAt: sandboxData.resumedAt ? new Date(sandboxData.resumedAt) : undefined,
      pauseTimeoutAt: sandboxData.pauseTimeoutAt ? new Date(sandboxData.pauseTimeoutAt) : undefined,
      totalPausedSeconds: sandboxData.totalPausedSeconds,
      
      // Kubernetes deployment information
      clusterId: sandboxData.clusterId,
      namespaceId: sandboxData.namespaceId,
      podName: sandboxData.podName,
      podUid: sandboxData.podUid,
      podIp: sandboxData.podIp,
      nodeName: sandboxData.nodeName,
      containerName: sandboxData.containerName,
      allocationTime: sandboxData.allocationTime ? new Date(sandboxData.allocationTime) : undefined,
      lastPodStatus: sandboxData.lastPodStatus,
      
      // State management information
      deletionInProgress: sandboxData.deletionInProgress || false,
      
      // Access token
      envdAccessToken: sandboxData.envdAccessToken,
      
      // Resource and cost information
      resources: sandboxData.resources || {
        cpu: sandboxData.cpuCount || 1,
        memory: sandboxData.memoryMb || 512,
        storage: sandboxData.storageGb || 0,
        bandwidth: 0
      },
      cost: sandboxData.cost || {
        hourlyRate: 0.0,
        totalCost: 0.0
      },
      
      // Owner information
      owner: sandboxData.owner,
      ownerUserId: sandboxData.ownerUserId,
      projectId: sandboxData.projectId,
      projectName: sandboxData.projectName,
      
      // Object storage information (only uri and mountPoint are returned, credentials are not included for security)
      // processResponse already converts snake_case to camelCase recursively, so object_storage -> objectStorage, mount_point -> mountPoint
      objectStorage: sandboxData.objectStorage ? {
        uri: sandboxData.objectStorage.uri,
        mountPoint: sandboxData.objectStorage.mountPoint
      } : undefined,
      
      // Network proxy configuration
      netProxyCountry: sandboxData.netProxyCountry
    }
  }

  /**
   * Delete sandbox - using correct path parameters
   */
  async deleteSandbox(sandboxId: string, force: boolean = true) {
    const response = await this.client.DELETE('/v1/sandboxes/{sandbox_id}', {
      params: { 
        path: { sandbox_id: sandboxId },
        query: { force }
      }
    })

    if (response.error) {
      throw new Error(`Failed to delete sandbox: ${JSON.stringify(response.error)}`)
    }

    // 处理响应，将 snake_case 转换为 camelCase
    const processedResponse = this.processResponse(response) as any
    // DELETE 操作返回 { success: true, data: {...}, message: "..." } 结构
    return processedResponse.data?.data || processedResponse.data || {}
  }

  /**
   * 执行代码
   */
  async executeCode(request: {
    code: string
    language: string
    contextId?: string
    envVars?: Record<string, string>
  }) {
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/execute' as any, {
      params: { path: { sandbox_id: this.sandboxId || 'default' } },
      body: {
        code: request.code,
        language: request.language,
        context_id: request.contextId,
        env_vars: request.envVars
      }
    })

    if (response.error) {
      throw new Error(`Failed to execute code: ${JSON.stringify(response.error)}`)
    }

    // Process response and convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const executeData = processedResponse.data?.data
    
    if (!executeData) {
      throw new Error('Invalid response: missing execute data')
    }
    
    return executeData
  }

  /**
   * 创建上下文
   */
  async createContext(request: {
    language: string
    cwd?: string
    envVars?: Record<string, string>
  }): Promise<any> {
    const response = await this.client.POST('/v1/contexts' as any, {
      body: {
        language: request.language,
        cwd: request.cwd,
        env_vars: request.envVars
      }
    })

    if (response.error) {
      throw new Error(`Failed to create context: ${JSON.stringify(response.error)}`)
    }

    // Process response and convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const contextData = processedResponse.data?.data
    
    if (!contextData) {
      throw new Error('Invalid response: missing context data')
    }
    
    return {
      id: contextData.id || contextData.context_id || `context-${Date.now()}`,
      language: contextData.language || request.language,
      cwd: contextData.cwd || request.cwd || '/tmp',
      envVars: contextData.envVars || contextData.env_vars || request.envVars || {},
      createdAt: contextData.createdAt || contextData.created_at || new Date().toISOString()
    }
  }

  /**
   * 获取上下文信息
   */
  async getContext(contextId: string): Promise<any> {
    const response = await this.client.GET('/v1/contexts/{context_id}' as any, {
      params: { path: { context_id: contextId } }
    })

    if (response.error) {
      throw new Error(`Failed to get context: ${JSON.stringify(response.error)}`)
    }

    // Process response and convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const contextData = processedResponse.data?.data
    
    if (!contextData) {
      throw new Error('Invalid response: missing context data')
    }
    
    return {
      id: contextData.id || contextData.context_id || contextId,
      language: contextData.language || '',
      cwd: contextData.cwd || '/tmp',
      envVars: contextData.envVars || contextData.env_vars || {},
      createdAt: contextData.createdAt || contextData.created_at || new Date().toISOString()
    }
  }

  /**
   * 删除上下文
   */
  async deleteContext(contextId: string): Promise<void> {
    const response = await this.client.DELETE('/v1/contexts/{context_id}' as any, {
      params: { path: { context_id: contextId } }
    })

    if (response.error) {
      throw new Error(`Failed to delete context: ${JSON.stringify(response.error)}`)
    }
  }

  /**
   * 列出沙箱
   */
  async listSandboxes(opts: {
    query?: SandboxQuery
    limit?: number
    nextToken?: string
  } = {}): Promise<{ sandboxes: SandboxInfo[], nextToken?: string }> {
    // Build query parameters according to OpenAPI schema
    type QueryParams = NonNullable<paths['/v1/sandboxes']['get']['parameters']['query']>
    const queryParams: QueryParams = {}
    
    // Handle status filter - backend accepts single status string, SDK accepts array for convenience
    if (opts.query?.status && opts.query.status.length > 0) {
      // Use first status if multiple provided (backend only accepts single status)
      queryParams.status = opts.query.status[0] as QueryParams['status']
    }
    
    // Handle limit
    if (opts.limit !== undefined) {
      queryParams.limit = opts.limit
    }
    
    // Handle pagination - backend uses offset, SDK uses nextToken
    // For now, nextToken is not fully implemented in backend, so we'll skip it
    // TODO: Implement proper token-based pagination when backend supports it
    
    // Note: metadata and templateId filters from SandboxQuery are not supported by backend API as query parameters
    // They would need to be filtered client-side or added to backend API in the future
    
    const response = await this.client.GET('/v1/sandboxes', {
      params: {
        query: queryParams
      }
    })

    if (response.error) {
      throw new Error(`Failed to list sandboxes: ${response.error}`)
    }

    // 处理响应，将 snake_case 转换为 camelCase
    const processedResponse = this.processResponse(response) as any
    const sandboxesData = processedResponse.data?.data?.sandboxes || processedResponse.data?.sandboxes || []
    
    // 转换每个沙箱数据
    const sandboxes = sandboxesData.map((sandbox: any) => ({
      // 标准字段
      sandboxId: sandbox.sandboxId || sandbox.sandbox_id || '',
      templateId: sandbox.templateId || sandbox.template_id || '',
      name: sandbox.name || '',
      metadata: sandbox.metadata || {},
      startedAt: sandbox.startedAt ? new Date(sandbox.startedAt) : new Date(),
      endAt: sandbox.stoppedAt ? new Date(sandbox.stoppedAt) : new Date(),
      status: sandbox.status || 'created',
      cpuCount: sandbox.cpuCount || sandbox.cpu_count || 1,
      memoryMB: sandbox.memoryMB || sandbox.memory_mb || 512,
      envdVersion: '1.0.0',
      envs: sandbox.envVars || sandbox.env_vars || {},
      
      // Scalebox扩展字段
      templateName: sandbox.templateName || sandbox.template_name,
      sandboxDomain: sandbox.sandboxDomain || sandbox.sandbox_domain,
      timeout: sandbox.timeout,
      uptime: sandbox.uptime || 0,
      
      // Lifecycle management fields
      substatus: sandbox.substatus,
      reason: sandbox.reason,
      stoppedAt: sandbox.stoppedAt ? new Date(sandbox.stoppedAt) : undefined,
      timeoutAt: sandbox.timeoutAt ? new Date(sandbox.timeoutAt) : undefined,
      endedAt: sandbox.endedAt ? new Date(sandbox.endedAt) : undefined,
      createdAt: sandbox.createdAt ? new Date(sandbox.createdAt) : new Date(),
      updatedAt: sandbox.updatedAt ? new Date(sandbox.updatedAt) : new Date(),
      
      // Pause/Resume tracking fields
      pausedAt: sandbox.pausedAt ? new Date(sandbox.pausedAt) : undefined,
      resumedAt: sandbox.resumedAt ? new Date(sandbox.resumedAt) : undefined,
      pauseTimeoutAt: sandbox.pauseTimeoutAt ? new Date(sandbox.pauseTimeoutAt) : undefined,
      totalPausedSeconds: sandbox.totalPausedSeconds,
      
      // Kubernetes deployment information
      clusterId: sandbox.clusterId,
      namespaceId: sandbox.namespaceId,
      podName: sandbox.podName,
      podUid: sandbox.podUid,
      podIp: sandbox.podIp,
      nodeName: sandbox.nodeName,
      containerName: sandbox.containerName,
      allocationTime: sandbox.allocationTime ? new Date(sandbox.allocationTime) : undefined,
      lastPodStatus: sandbox.lastPodStatus,
      
      // 状态管理信息
      deletionInProgress: sandbox.deletionInProgress || false,
      
      // 访问令牌
      envdAccessToken: sandbox.envdAccessToken,
      
      // 资源和成本信息
      resources: sandbox.resources || {
        cpu: sandbox.cpuCount || sandbox.cpu_count || 1,
        memory: sandbox.memoryMB || sandbox.memory_mb || 512,
        storage: sandbox.storageGB || sandbox.storage_gb || 0,
        bandwidth: 0
      },
      cost: sandbox.cost || {
        hourlyRate: 0.0,
        totalCost: 0.0
      },
      
      // 所有者信息
      owner: sandbox.owner,
      ownerUserId: sandbox.ownerUserId || sandbox.owner_user_id,
      projectId: sandbox.projectId || sandbox.project_id,
      projectName: sandbox.projectName || sandbox.project_name,
      
      // Object storage information (only uri and mountPoint are returned, credentials are not included for security)
      // processResponse already converts snake_case to camelCase recursively, so object_storage -> objectStorage, mount_point -> mountPoint
      objectStorage: sandbox.objectStorage ? {
        uri: sandbox.objectStorage.uri,
        mountPoint: sandbox.objectStorage.mountPoint
      } : undefined,
      
      // Port configuration
      ports: sandbox.ports || [],
      templatePorts: sandbox.templatePorts || sandbox.template_ports || [],
      customPorts: sandbox.customPorts || sandbox.custom_ports || [],
      
      // Network proxy configuration
      netProxyCountry: sandbox.netProxyCountry
    }))

    return {
      sandboxes,
      nextToken: undefined
    }
  }

  /**
   * 从沙箱创建模板
   */
  async createTemplateFromSandbox(
    sandboxId: string,
    request: {
      name: string
      description?: string
      visibility?: 'private' | 'account_shared' | 'public'
      cpuCount?: number
      memoryMB?: number
      ports?: string // JSON string of port configurations
      resetPorts?: boolean
      customCommand?: string
      readyCommand?: string
    }
  ): Promise<{
    templateId: string
    name: string
    description?: string
    defaultCpuCount: number
    defaultMemoryMB: number
    visibility: 'private' | 'account_shared' | 'public'
    status: string
    harborProject: string
    harborRepository: string
    harborTag: string
    baseTemplateId?: string
    ports?: string
    customCommand?: string
    readyCommand?: string
    createdAt: Date
    message: string
  }> {
    const backendRequest = convertKeysToSnakeCase(request)
    
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/create-template', {
      params: {
        path: { sandbox_id: sandboxId }
      },
      body: backendRequest
    })

    if (response.error) {
      throw new Error(`Failed to create template from sandbox: ${JSON.stringify(response.error)}`)
    }

    const processedResponse = this.processResponse(response) as any
    const templateData = processedResponse.data?.data || processedResponse.data

    if (!templateData) {
      throw new Error('Invalid response: missing template data')
    }

    return {
      templateId: templateData.templateId || templateData.template_id || '',
      name: templateData.name || '',
      description: templateData.description,
      defaultCpuCount: templateData.defaultCpuCount || templateData.default_cpu_count || 2,
      defaultMemoryMB: templateData.defaultMemoryMB || templateData.default_memory_mb || 512,
      visibility: templateData.visibility || templateData.Visibility || 'private',
      status: templateData.status || 'pending',
      harborProject: templateData.harborProject || templateData.harbor_project || '',
      harborRepository: templateData.harborRepository || templateData.harbor_repository || '',
      harborTag: templateData.harborTag || templateData.harbor_tag || 'latest',
      baseTemplateId: templateData.baseTemplateId || templateData.base_template_id,
      ports: templateData.ports,
      customCommand: templateData.customCommand || templateData.custom_command,
      readyCommand: templateData.readyCommand || templateData.ready_command,
      createdAt: templateData.createdAt ? new Date(templateData.createdAt) : new Date(),
      message: templateData.message || 'Template creation initiated'
    }
  }

  /**
   * 获取沙箱端口列表
   */
  async getSandboxPorts(sandboxId: string): Promise<{
    ports: PortConfig[]
    templatePorts: PortConfig[]
    customPorts: PortConfig[]
  }> {
    const response = await this.client.GET('/v1/sandboxes/{sandbox_id}/ports', {
      params: {
        path: { sandbox_id: sandboxId }
      }
    })

    if (response.error) {
      throw new Error(`Failed to get sandbox ports: ${JSON.stringify(response.error)}`)
    }

    const processedResponse = this.processResponse(response) as any
    const portsData = processedResponse.data?.data || processedResponse.data

    return {
      ports: portsData.ports || [],
      templatePorts: portsData.templatePorts || portsData.template_ports || [],
      customPorts: portsData.customPorts || portsData.custom_ports || []
    }
  }

  /**
   * 添加自定义端口到沙箱
   */
  async addSandboxPort(
    sandboxId: string,
    port: PortConfig
  ): Promise<SandboxInfo> {
    const backendRequest = convertKeysToSnakeCase(port)
    
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/ports', {
      params: {
        path: { sandbox_id: sandboxId }
      },
      body: backendRequest
    })

    if (response.error) {
      throw new Error(`Failed to add port: ${JSON.stringify(response.error)}`)
    }

    const processedResponse = this.processResponse(response) as any
    const sandboxData = processedResponse.data?.data || processedResponse.data

    if (!sandboxData) {
      throw new Error('Invalid response: missing sandbox data')
    }

    // 复用 createSandbox 中的转换逻辑
    const sandboxStartedAt = sandboxData.startedAt ? new Date(sandboxData.startedAt) : new Date()
    const sandboxEndAt = sandboxData.timeoutAt 
      ? new Date(sandboxData.timeoutAt)
      : new Date(sandboxStartedAt.getTime() + (sandboxData.timeout || 300) * 1000)

    return {
      sandboxId: sandboxData.sandboxId || sandboxData.sandbox_id || '',
      templateId: sandboxData.templateId || sandboxData.template_id || '',
      name: sandboxData.name || '',
      metadata: sandboxData.metadata || {},
      startedAt: sandboxStartedAt,
      endAt: sandboxEndAt,
      status: sandboxData.status || 'created',
      cpuCount: sandboxData.cpuCount || sandboxData.cpu_count || 1,
      memoryMB: sandboxData.memoryMB || sandboxData.memory_mb || 512,
      envdVersion: '1.0.0',
      envs: sandboxData.envVars || sandboxData.env_vars || {},
      templateName: sandboxData.templateName || sandboxData.template_name,
      sandboxDomain: sandboxData.sandboxDomain || sandboxData.sandbox_domain,
      timeout: sandboxData.timeout,
      uptime: sandboxData.uptime || 0,
      substatus: sandboxData.substatus,
      reason: sandboxData.reason,
      stoppedAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : undefined,
      timeoutAt: sandboxData.timeoutAt ? new Date(sandboxData.timeoutAt) : undefined,
      endedAt: sandboxData.endedAt ? new Date(sandboxData.endedAt) : undefined,
      createdAt: sandboxData.createdAt ? new Date(sandboxData.createdAt) : new Date(),
      updatedAt: sandboxData.updatedAt ? new Date(sandboxData.updatedAt) : new Date(),
      pausedAt: sandboxData.pausedAt ? new Date(sandboxData.pausedAt) : undefined,
      resumedAt: sandboxData.resumedAt ? new Date(sandboxData.resumedAt) : undefined,
      pauseTimeoutAt: sandboxData.pauseTimeoutAt ? new Date(sandboxData.pauseTimeoutAt) : undefined,
      totalPausedSeconds: sandboxData.totalPausedSeconds,
      clusterId: sandboxData.clusterId,
      namespaceId: sandboxData.namespaceId,
      podName: sandboxData.podName,
      podUid: sandboxData.podUid,
      podIp: sandboxData.podIp,
      nodeName: sandboxData.nodeName,
      containerName: sandboxData.containerName,
      allocationTime: sandboxData.allocationTime ? new Date(sandboxData.allocationTime) : undefined,
      lastPodStatus: sandboxData.lastPodStatus,
      deletionInProgress: sandboxData.deletionInProgress || false,
      envdAccessToken: sandboxData.envdAccessToken,
      resources: sandboxData.resources || {
        cpu: sandboxData.cpuCount || sandboxData.cpu_count || 1,
        memory: sandboxData.memoryMB || sandboxData.memory_mb || 512,
        storage: sandboxData.storageGB || sandboxData.storage_gb || 0,
        bandwidth: 0
      },
      cost: sandboxData.cost || {
        hourlyRate: 0.0,
        totalCost: 0.0
      },
      owner: sandboxData.owner,
      ownerUserId: sandboxData.ownerUserId || sandboxData.owner_user_id,
      projectId: sandboxData.projectId || sandboxData.project_id,
      projectName: sandboxData.projectName || sandboxData.project_name,
      objectStorage: sandboxData.objectStorage ? {
        uri: sandboxData.objectStorage.uri,
        mountPoint: sandboxData.objectStorage.mountPoint
      } : undefined,
      ports: sandboxData.ports || [],
      templatePorts: sandboxData.templatePorts || sandboxData.template_ports || [],
      customPorts: sandboxData.customPorts || sandboxData.custom_ports || [],
      
      // Network proxy configuration
      netProxyCountry: sandboxData.netProxyCountry
    }
  }

  /**
   * 从沙箱删除自定义端口
   */
  async removeSandboxPort(sandboxId: string, port: number): Promise<void> {
    const response = await this.client.DELETE('/v1/sandboxes/{sandbox_id}/ports/{port}', {
      params: {
        path: {
          sandbox_id: sandboxId,
          port: port
        }
      }
    })

    if (response.error) {
      throw new Error(`Failed to remove port: ${JSON.stringify(response.error)}`)
    }
  }

  /**
   * 获取沙箱指标
   */
  async getSandboxMetrics(sandboxId: string): Promise<SandboxMetrics> {
    const response = await this.client.GET('/v1/sandboxes/{sandbox_id}/metrics' as any, {
      params: { path: { sandbox_id: sandboxId } }
    })

    if (response.error) {
      throw new Error(`Failed to get sandbox metrics: ${JSON.stringify(response.error)}`)
    }

    // Process response and convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const metricsData = processedResponse.data?.data
    
    if (!metricsData) {
      throw new Error('Invalid response: missing metrics data')
    }

    return {
      timestamp: metricsData.timestamp ? new Date(metricsData.timestamp) : new Date(),
      cpuUsedPct: metricsData.cpuUsedPct || metricsData.cpu_used_pct || 0,
      cpuCount: metricsData.cpuCount || metricsData.cpu_count || 1,
      memUsed: metricsData.memUsed || metricsData.mem_used || 0,
      memTotal: metricsData.memTotal || metricsData.mem_total || 512,
      diskUsed: metricsData.diskUsed || metricsData.disk_used || 0,
      diskTotal: metricsData.diskTotal || metricsData.disk_total || 1024
    }
  }

  /**
   * Pause sandbox
   */
  async pauseSandbox(sandboxId: string): Promise<void> {
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/pause' as any, {
      params: { path: { sandbox_id: sandboxId } }
    })

    if (response.error) {
      throw new Error(`Failed to pause sandbox: ${JSON.stringify(response.error)}`)
    }
  }

  /**
   * @deprecated This method is deprecated, please use {@link connectSandbox} instead
   * 
   * Resume sandbox
   * @param sandboxId sandbox ID
   * @param timeoutMs optional timeout in milliseconds
   * Note: backend resume endpoint currently does not accept timeout parameter, timeout is automatically calculated by state machine based on pause duration
   * This parameter is reserved for future possible extensions and is currently ignored
   * 
   * @see {@link connectSandbox} - Recommended unified connect endpoint that automatically handles running or paused sandboxes
   */
  async resumeSandbox(sandboxId: string, timeoutMs?: number): Promise<void> {
    // Backend resume endpoint does not accept timeout parameter, timeout is automatically calculated by state machine
    // timeoutMs parameter is reserved for future possible extensions, but is not currently sent to backend
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/resume' as any, {
      params: { path: { sandbox_id: sandboxId } }
      // Note: backend does not accept body parameters, timeout is automatically calculated by state machine based on pause duration
    })

    if (response.error) {
      throw new Error(`Failed to resume sandbox: ${JSON.stringify(response.error)}`)
    }
  }

  /**
   * Update sandbox timeout
   */
  async updateSandboxTimeout(sandboxId: string, timeoutMs: number): Promise<void> {
    const timeoutSeconds = Math.floor(timeoutMs / 1000) // Convert ms to seconds
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/timeout' as any, {
      params: { path: { sandbox_id: sandboxId } },
      body: { timeout: timeoutSeconds }
    })

    if (response.error) {
      throw new Error(`Failed to update sandbox timeout: ${JSON.stringify(response.error)}`)
    }
  }

  /**
   * Connect to sandbox (unified endpoint)
   * If sandbox is running, returns sandbox info immediately
   * If sandbox is paused, automatically resumes and waits for completion
   * @param sandboxId sandbox ID
   * @param timeoutMs optional timeout in milliseconds, if provided updates sandbox timeout
   * @returns sandbox information
   */
  async connectSandbox(sandboxId: string, timeoutMs?: number): Promise<SandboxInfo> {
    const body: { timeout?: number } = {}
    if (timeoutMs !== undefined) {
      body.timeout = Math.floor(timeoutMs / 1000) // Convert ms to seconds
    }

    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/connect' as any, {
      params: { path: { sandbox_id: sandboxId } },
      body: Object.keys(body).length > 0 ? body : undefined
    })

    if (response.error) {
      throw new Error(`Failed to connect to sandbox: ${JSON.stringify(response.error)}`)
    }

    // Process response, convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const sandboxData = processedResponse.data?.data
    
    if (!sandboxData) {
      throw new Error('Invalid response: missing sandbox data')
    }
    
    // Since processResponse has already converted keys, use camelCase fields directly
    const sandboxStartedAt = sandboxData.startedAt ? new Date(sandboxData.startedAt) : new Date()
    const sandboxEndAt = sandboxData.timeoutAt 
      ? new Date(sandboxData.timeoutAt)
      : new Date(sandboxStartedAt.getTime() + (sandboxData.timeout || 300) * 1000)
    
    const sandboxInfo: SandboxInfo = {
      sandboxId: sandboxData.sandboxId || sandboxData.sandbox_id || '',
      templateId: sandboxData.templateId || sandboxData.template_id || '',
      name: sandboxData.name || '',
      metadata: sandboxData.metadata || {},
      startedAt: sandboxStartedAt,
      endAt: sandboxEndAt,
      status: (sandboxData.status || sandboxData.state || 'running') as SandboxInfo['status'],
      cpuCount: sandboxData.cpuCount || sandboxData.cpu_count || 1,
      memoryMB: sandboxData.memoryMB || sandboxData.memory_mb || 512,
      envdVersion: sandboxData.envdVersion || sandboxData.envd_version || '1.0.0',
      envs: sandboxData.envs || sandboxData.env_vars || {},
      templateName: sandboxData.templateName || sandboxData.template_name,
      sandboxDomain: sandboxData.sandboxDomain || sandboxData.domain,
      timeout: sandboxData.timeout,
      uptime: sandboxData.uptime || 0,
      substatus: sandboxData.substatus,
      reason: sandboxData.reason,
      stoppedAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : undefined,
      timeoutAt: sandboxData.timeoutAt ? new Date(sandboxData.timeoutAt) : undefined,
      endedAt: sandboxData.endedAt ? new Date(sandboxData.endedAt) : undefined,
      createdAt: sandboxData.createdAt ? new Date(sandboxData.createdAt) : new Date(),
      updatedAt: sandboxData.updatedAt ? new Date(sandboxData.updatedAt) : new Date(),
      pausedAt: sandboxData.pausedAt ? new Date(sandboxData.pausedAt) : undefined,
      resumedAt: sandboxData.resumedAt ? new Date(sandboxData.resumedAt) : undefined,
      pauseTimeoutAt: sandboxData.pauseTimeoutAt ? new Date(sandboxData.pauseTimeoutAt) : undefined,
      totalPausedSeconds: sandboxData.totalPausedSeconds,
      clusterId: sandboxData.clusterId,
      namespaceId: sandboxData.namespaceId,
      podName: sandboxData.podName,
      podUid: sandboxData.podUid,
      podIp: sandboxData.podIp,
      nodeName: sandboxData.nodeName,
      containerName: sandboxData.containerName,
      allocationTime: sandboxData.allocationTime ? new Date(sandboxData.allocationTime) : undefined,
      lastPodStatus: sandboxData.lastPodStatus,
      deletionInProgress: sandboxData.deletionInProgress || false,
      envdAccessToken: sandboxData.envdAccessToken || sandboxData.envd_access_token,
      resources: sandboxData.resources || {
        cpu: sandboxData.cpuCount || sandboxData.cpu_count || 1,
        memory: sandboxData.memoryMB || sandboxData.memory_mb || 512,
        storage: sandboxData.storageGB || sandboxData.storage_gb || 0,
        bandwidth: 0
      },
      cost: sandboxData.cost || {
        hourlyRate: 0.0,
        totalCost: 0.0
      },
      owner: sandboxData.owner,
      ownerUserId: sandboxData.ownerUserId || sandboxData.owner_user_id,
      projectId: sandboxData.projectId || sandboxData.project_id,
      projectName: sandboxData.projectName || sandboxData.project_name,
      objectStorage: sandboxData.objectStorage ? {
        uri: sandboxData.objectStorage.uri,
        mountPoint: sandboxData.objectStorage.mountPoint
      } : undefined,
      ports: sandboxData.ports || [],
      templatePorts: sandboxData.templatePorts || sandboxData.template_ports || [],
      customPorts: sandboxData.customPorts || sandboxData.custom_ports || [],
      
      // Network proxy configuration
      netProxyCountry: sandboxData.netProxyCountry
    }
    
    return sandboxInfo
  }

  /**
   * Get available Sandbox Regions that have eligible clusters.
   * 
   * This is a public API (no authentication required) to help users discover
   * available regions for locality-based scheduling.
   * 
   * @returns List of available Sandbox Regions with their IDs and names
   * 
   * @example
   * ```ts
   * const regions = await client.getSandboxRegions()
   * console.log(regions) // [{ id: 'us-east', name: 'US East (N. Virginia)' }, ...]
   * ```
   */
  async getSandboxRegions(): Promise<SandboxRegion[]> {
    const response = await this.client.GET('/v1/sandbox-regions')

    if (response.error) {
      throw new Error(`Failed to get sandbox regions: ${JSON.stringify(response.error)}`)
    }

    // Process response and convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const regionsData = processedResponse.data?.data?.sandboxRegions || []

    return regionsData.map((region: any) => ({
      id: region.id || region.region_id || '',
      name: region.name || region.region_name || region.id || ''
    }))
  }
}