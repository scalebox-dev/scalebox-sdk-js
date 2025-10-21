import createClient from 'openapi-fetch'
import { paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { SandboxInfo, SandboxMetrics, SandboxQuery } from '../sandbox/types'

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
      timeout: request.timeout || 300, // 默认 5 分钟
      envVars: request.envVars, // 将转换为 env_vars
      secure: request.secure ?? true, // 默认启用安全
      allowInternetAccess: request.allowInternetAccess ?? true, // 将转换为 allow_internet_access
      isAsync: request.isAsync ?? false // 将转换为 is_async，默认同步
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
    return {
      // 标准字段
      sandboxId: sandboxData.sandboxId || '',
      templateId: sandboxData.templateId || '',
      name: sandboxData.name || '',
      metadata: sandboxData.metadata || {},
      startedAt: sandboxData.startedAt ? new Date(sandboxData.startedAt) : new Date(),
      endAt: sandboxData.createdAt ? new Date(new Date(sandboxData.createdAt).getTime() + (sandboxData.timeout || 300) * 1000) : new Date(),
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
      
      // 生命周期管理字段
      substatus: sandboxData.substatus,
      reason: sandboxData.reason,
      stoppedAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : undefined,
      timeoutAt: sandboxData.timeoutAt ? new Date(sandboxData.timeoutAt) : undefined,
      endedAt: sandboxData.endedAt ? new Date(sandboxData.endedAt) : undefined,
      createdAt: sandboxData.createdAt ? new Date(sandboxData.createdAt) : new Date(),
      updatedAt: sandboxData.updatedAt ? new Date(sandboxData.updatedAt) : new Date(),
      
      // Kubernetes 部署信息
      clusterId: sandboxData.clusterId,
      namespaceId: sandboxData.namespaceId,
      podName: sandboxData.podName,
      podUid: sandboxData.podUid,
      podIp: sandboxData.podIp,
      nodeName: sandboxData.nodeName,
      containerName: sandboxData.containerName,
      allocationTime: sandboxData.allocationTime ? new Date(sandboxData.allocationTime) : undefined,
      lastPodStatus: sandboxData.lastPodStatus,
      
      // 状态管理信息
      deletionInProgress: sandboxData.deletionInProgress || false,
      
      // 访问令牌
      envdAccessToken: sandboxData.envdAccessToken,
      
      // 资源和成本信息
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
      
      // 所有者信息
      owner: sandboxData.owner,
      ownerUserId: sandboxData.ownerUserId,
      projectId: sandboxData.projectId,
      projectName: sandboxData.projectName
    }
  }

  /**
   * 获取沙箱信息 - 使用正确的路径参数和字段转换
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
    return {
      // 标准字段
      sandboxId: sandboxData.sandboxId || '',
      templateId: sandboxData.templateId || '',
      name: sandboxData.name || '',
      metadata: sandboxData.metadata || {},
      startedAt: sandboxData.startedAt ? new Date(sandboxData.startedAt) : new Date(),
      endAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : new Date(),
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
      
      // 生命周期管理字段
      substatus: sandboxData.substatus,
      reason: sandboxData.reason,
      stoppedAt: sandboxData.stoppedAt ? new Date(sandboxData.stoppedAt) : undefined,
      timeoutAt: sandboxData.timeoutAt ? new Date(sandboxData.timeoutAt) : undefined,
      endedAt: sandboxData.endedAt ? new Date(sandboxData.endedAt) : undefined,
      createdAt: sandboxData.createdAt ? new Date(sandboxData.createdAt) : new Date(),
      updatedAt: sandboxData.updatedAt ? new Date(sandboxData.updatedAt) : new Date(),
      
      // Kubernetes 部署信息
      clusterId: sandboxData.clusterId,
      namespaceId: sandboxData.namespaceId,
      podName: sandboxData.podName,
      podUid: sandboxData.podUid,
      podIp: sandboxData.podIp,
      nodeName: sandboxData.nodeName,
      containerName: sandboxData.containerName,
      allocationTime: sandboxData.allocationTime ? new Date(sandboxData.allocationTime) : undefined,
      lastPodStatus: sandboxData.lastPodStatus,
      
      // 状态管理信息
      deletionInProgress: sandboxData.deletionInProgress || false,
      
      // 访问令牌
      envdAccessToken: sandboxData.envdAccessToken,
      
      // 资源和成本信息
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
      
      // 所有者信息
      owner: sandboxData.owner,
      ownerUserId: sandboxData.ownerUserId,
      projectId: sandboxData.projectId,
      projectName: sandboxData.projectName
    }
  }

  /**
   * 删除沙箱 - 使用正确的路径参数
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

    return response.data
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
    return processedResponse.data?.data || processedResponse.data
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
    const contextData = processedResponse.data?.data || processedResponse.data
    
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
    const contextData = processedResponse.data?.data || processedResponse.data
    
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
    const response = await this.client.GET('/v1/sandboxes')

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
      
      // 生命周期管理字段
      substatus: sandbox.substatus,
      reason: sandbox.reason,
      stoppedAt: sandbox.stoppedAt ? new Date(sandbox.stoppedAt) : undefined,
      timeoutAt: sandbox.timeoutAt ? new Date(sandbox.timeoutAt) : undefined,
      endedAt: sandbox.endedAt ? new Date(sandbox.endedAt) : undefined,
      createdAt: sandbox.createdAt ? new Date(sandbox.createdAt) : new Date(),
      updatedAt: sandbox.updatedAt ? new Date(sandbox.updatedAt) : new Date(),
      
      // Kubernetes 部署信息
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
      projectName: sandbox.projectName || sandbox.project_name
    }))

    return {
      sandboxes,
      nextToken: undefined
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
    const metricsData = processedResponse.data?.data || processedResponse.data
    
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
   * 暂停沙箱
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
   * 恢复沙箱
   */
  async resumeSandbox(sandboxId: string): Promise<void> {
    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/resume' as any, {
      params: { path: { sandbox_id: sandboxId } }
    })

    if (response.error) {
      throw new Error(`Failed to resume sandbox: ${JSON.stringify(response.error)}`)
    }
  }

  /**
   * 更新沙箱超时时间
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
}