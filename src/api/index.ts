import createClient from 'openapi-fetch'
import { paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { SandboxInfo, SandboxMetrics, SandboxQuery, ObjectStorageConfig, PortConfig, LocalityConfig, ScaleboxRegion } from '../sandbox/types'
import type {
  TemplateInfo,
  TemplateListFilters,
  TemplateListResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  UpdateTemplateStatusRequest,
  TemplateChainResponse,
  ShareTemplateRequest,
  ValidateCustomImageRequest,
  ValidateCustomImageResponse,
  DirectImportTemplateRequest,
  DirectImportTemplateResponse,
  TemplateImportStatusResponse,
  ImportJobInfo,
  ListImportJobsOpts,
  ListImportJobsResponse
} from '../template/types'

/** CamelCase batch operation result item (after processResponse) */
export interface BatchResultItem {
  sandboxId: string
  status: string
  error?: string
}

/** Response shape for batch delete (backend may return successful_count/failed_count + successful[]/failed[] or results[]) */
interface BatchDeleteDataShape {
  total?: number
  successfulCount?: number
  failedCount?: number
  successful?: string[]
  failed?: Array<{ sandboxId?: string; sandbox_id?: string; error?: string }>
  results?: Array<{ sandboxId?: string; sandbox_id?: string; status?: string; error?: string }>
}

/** Response shape for batch terminate/pause/resume (total, successful, failed, results[]) */
interface BatchOperationDataShape {
  total?: number
  successful?: number
  failed?: number
  results?: Array<{ sandboxId?: string; sandbox_id?: string; status?: string; error?: string }>
}

type BatchResultItemRaw = { sandboxId?: string; sandbox_id?: string; status?: string; error?: string }

function normalizeBatchResultItem(r: BatchResultItemRaw): BatchResultItem {
  return {
    sandboxId: r.sandboxId ?? r.sandbox_id ?? '',
    status: r.status ?? 'error',
    error: r.error
  }
}

function formatApiError(prefix: string, err: unknown): string {
  if (err == null) return `${prefix}: unknown error`
  if (typeof err === 'object' && 'detail' in err && (err as { detail?: unknown }).detail != null) {
    return `${prefix}: ${String((err as { detail: unknown }).detail)}`
  }
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return `${prefix}: ${(err as { message: string }).message}`
  }
  return `${prefix}: ${JSON.stringify(err)}`
}

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
  private processResponse<T>(response: { error?: unknown; data?: unknown }): T {
    if (response.error != null) {
      throw new Error(formatApiError('API request failed', response.error))
    }
    const res = response as { data?: unknown }
    if (res.data != null && typeof res.data === 'object') {
      (res as { data: unknown }).data = convertKeysToCamelCase(res.data)
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
    /** If true, return immediately (sandbox may be starting); if false or omitted, backend waits until running/failed (default). */
    isAsync?: boolean
    // 扩展参数
    name?: string
    description?: string
    projectId?: string
    cpuCount?: number
    memoryMB?: number
    storageGB?: number
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
      autoPause: request.autoPause ?? false, // 将转换为 auto_pause，超时后 pause 或 terminate
      objectStorage: request.objectStorage, // 将转换为 object_storage
      customPorts: request.customPorts, // 将转换为 custom_ports
      netProxyCountry: request.netProxyCountry, // 将转换为 net_proxy_country
      locality: request.locality // 将转换为 locality (nested object, keys will be converted)
    })
    if (request.isAsync === true) {
      (backendRequest as Record<string, unknown>).is_async = true
    }

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
      totalRunningSeconds: sandboxData.totalRunningSeconds,
      actualTotalRunningSeconds: sandboxData.actualTotalRunningSeconds,
      actualTotalPausedSeconds: sandboxData.actualTotalPausedSeconds,
      
      // Persistence (plan-based)
      persistenceDays: sandboxData.persistenceDays,
      persistenceExpiresAt: sandboxData.persistenceExpiresAt ?? null,
      persistenceDaysRemaining: sandboxData.persistenceDaysRemaining ?? null,
      autoPause: sandboxData.autoPause ?? false,
      
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
      netProxyCountry: sandboxData.netProxyCountry,
      networkProxy: sandboxData.networkProxy ?? null
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
      totalRunningSeconds: sandboxData.totalRunningSeconds,
      actualTotalRunningSeconds: sandboxData.actualTotalRunningSeconds,
      actualTotalPausedSeconds: sandboxData.actualTotalPausedSeconds,
      
      // Persistence (plan-based)
      persistenceDays: sandboxData.persistenceDays,
      persistenceExpiresAt: sandboxData.persistenceExpiresAt ?? null,
      persistenceDaysRemaining: sandboxData.persistenceDaysRemaining ?? null,
      autoPause: sandboxData.autoPause ?? false,
      
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
      
      // Port configuration
      ports: sandboxData.ports || [],
      templatePorts: sandboxData.templatePorts || sandboxData.template_ports || [],
      customPorts: sandboxData.customPorts || sandboxData.custom_ports || [],
      
      // Network proxy configuration
      netProxyCountry: sandboxData.netProxyCountry,
      networkProxy: sandboxData.networkProxy ?? null
    }
  }

  /**
   * Get sandbox status (lightweight) - for polling only. Returns only sandbox_id, status, substatus, reason, updated_at.
   * Use this instead of getSandbox for status polling to reduce payload.
   */
  async getSandboxStatus(sandboxId: string): Promise<{
    sandboxId: string
    status: string
    substatus?: string | null
    reason?: string | null
    updatedAt: string
  }> {
    const response = await this.client.GET('/v1/sandboxes/{sandbox_id}/status', {
      params: { path: { sandbox_id: sandboxId } }
    })

    const err = 'error' in response ? response.error : undefined
    if (err != null) {
      throw new Error(formatApiError('Failed to get sandbox status', err))
    }

    const processedResponse = this.processResponse(response) as any
    const data = processedResponse.data?.data ?? processedResponse.data
    if (!data) {
      throw new Error('Invalid response: missing status data')
    }
    return {
      sandboxId: (data.sandboxId ?? data.sandbox_id ?? sandboxId) as string,
      status: (data.status ?? 'created') as string,
      substatus: data.substatus ?? null,
      reason: data.reason ?? null,
      updatedAt: (data.updatedAt ?? data.updated_at ?? new Date().toISOString()) as string
    }
  }

  /**
   * Poll getSandboxStatus until status is in targetStatuses or timeout. Uses lightweight status endpoint.
   * @param sandboxId sandbox ID
   * @param targetStatuses e.g. ['running','failed'] or ['paused','failed']
   * @param opts timeoutMs (default 120000), intervalMs (default 2000), signal (AbortSignal)
   * @returns final status object (including failed if caller includes it in targetStatuses)
   * @throws on timeout
   */
  async waitUntilStatus(
    sandboxId: string,
    targetStatuses: string[],
    opts?: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal }
  ): Promise<{ sandboxId: string; status: string; substatus?: string | null; reason?: string | null; updatedAt: string }> {
    const timeoutMs = opts?.timeoutMs ?? 120000
    const intervalMs = opts?.intervalMs ?? 2000
    const deadline = Date.now() + timeoutMs
    const set = new Set(targetStatuses.map(s => s.toLowerCase()))

    while (true) {
      if (opts?.signal?.aborted) {
        throw new Error(`waitUntilStatus aborted`)
      }
      if (Date.now() >= deadline) {
        const last = await this.getSandboxStatus(sandboxId).catch(() => null)
        throw new Error(
          `waitUntilStatus timed out after ${timeoutMs}ms. Last status: ${last?.status ?? 'unknown'}`
        )
      }
      const statusResp = await this.getSandboxStatus(sandboxId)
      if (set.has(statusResp.status.toLowerCase())) {
        return statusResp
      }
      const jitterMax = Math.min(500, Math.floor(intervalMs * 0.1))
      const jitter = jitterMax > 0 ? Math.floor(Math.random() * jitterMax) : 0
      await new Promise(r => setTimeout(r, intervalMs + jitter))
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
   * Batch delete sandboxes.
   * @param sandboxIds List of sandbox IDs to delete
   * @param options force - force deletion even if running (default false)
   */
  async batchDelete(
    sandboxIds: string[],
    options?: { force?: boolean }
  ): Promise<{ total: number; successful: number; failed: number; results: BatchResultItem[] }> {
    const response = await this.client.POST('/v1/sandboxes/batch-delete', {
      body: { sandbox_ids: sandboxIds, force: options?.force ?? false }
    })
    const err = 'error' in response ? response.error : undefined
    if (err != null) {
      throw new Error(formatApiError('Batch delete failed', err))
    }
    const processedResponse = this.processResponse<{ data?: { data?: BatchDeleteDataShape } }>(response)
    const data: BatchDeleteDataShape | undefined = processedResponse.data?.data ?? (processedResponse.data as BatchDeleteDataShape | undefined)
    if (!data) return { total: 0, successful: 0, failed: 0, results: [] }
    const successful = data.successfulCount ?? (Array.isArray(data.successful) ? data.successful.length : 0)
    const failed = data.failedCount ?? (Array.isArray(data.failed) ? data.failed.length : 0)
    const results: BatchResultItem[] = (data.results ?? []).map(normalizeBatchResultItem)
    if (results.length === 0 && (Array.isArray(data.successful) || Array.isArray(data.failed))) {
      for (const id of data.successful ?? []) results.push({ sandboxId: id, status: 'success' })
      for (const f of data.failed ?? []) results.push(normalizeBatchResultItem({ sandbox_id: f?.sandbox_id ?? f?.sandboxId, status: 'error', error: f?.error }))
    }
    return {
      total: data.total ?? (successful + failed),
      successful,
      failed,
      results
    }
  }

  /**
   * Batch terminate sandboxes.
   * @param sandboxIds List of sandbox IDs to terminate
   * @param options force - force termination even if running (default false)
   */
  async batchTerminate(
    sandboxIds: string[],
    options?: { force?: boolean }
  ): Promise<{ total: number; successful: number; failed: number; results: BatchResultItem[] }> {
    const response = await this.client.POST('/v1/sandboxes/batch-terminate', {
      body: { sandbox_ids: sandboxIds, force: options?.force ?? false }
    })
    const err = 'error' in response ? response.error : undefined
    if (err != null) {
      throw new Error(formatApiError('Batch terminate failed', err))
    }
    const processedResponse = this.processResponse<{ data?: { data?: BatchOperationDataShape } }>(response)
    const data: BatchOperationDataShape | undefined = processedResponse.data?.data ?? (processedResponse.data as BatchOperationDataShape | undefined)
    if (!data) return { total: 0, successful: 0, failed: 0, results: [] }
    return {
      total: data.total ?? 0,
      successful: data.successful ?? 0,
      failed: data.failed ?? 0,
      results: (data.results ?? []).map(normalizeBatchResultItem)
    }
  }

  /**
   * Batch pause sandboxes (running -> paused).
   */
  async batchPause(sandboxIds: string[]): Promise<{ total: number; successful: number; failed: number; results: BatchResultItem[] }> {
    const response = await this.client.POST('/v1/sandboxes/batch-pause', {
      body: { sandbox_ids: sandboxIds }
    })
    const err = 'error' in response ? response.error : undefined
    if (err != null) {
      throw new Error(formatApiError('Batch pause failed', err))
    }
    const processedResponse = this.processResponse<{ data?: { data?: BatchOperationDataShape } }>(response)
    const data: BatchOperationDataShape | undefined = processedResponse.data?.data ?? (processedResponse.data as BatchOperationDataShape | undefined)
    if (!data) return { total: 0, successful: 0, failed: 0, results: [] }
    return {
      total: data.total ?? 0,
      successful: data.successful ?? 0,
      failed: data.failed ?? 0,
      results: (data.results ?? []).map(normalizeBatchResultItem)
    }
  }

  /**
   * Batch resume sandboxes (paused -> running).
   */
  async batchResume(sandboxIds: string[]): Promise<{ total: number; successful: number; failed: number; results: BatchResultItem[] }> {
    const response = await this.client.POST('/v1/sandboxes/batch-resume', {
      body: { sandbox_ids: sandboxIds }
    })
    const err = 'error' in response ? response.error : undefined
    if (err != null) {
      throw new Error(formatApiError('Batch resume failed', err))
    }
    const processedResponse = this.processResponse<{ data?: { data?: BatchOperationDataShape } }>(response)
    const data: BatchOperationDataShape | undefined = processedResponse.data?.data ?? (processedResponse.data as BatchOperationDataShape | undefined)
    if (!data) return { total: 0, successful: 0, failed: 0, results: [] }
    return {
      total: data.total ?? 0,
      successful: data.successful ?? 0,
      failed: data.failed ?? 0,
      results: (data.results ?? []).map(normalizeBatchResultItem)
    }
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
      totalRunningSeconds: sandbox.totalRunningSeconds,
      actualTotalRunningSeconds: sandbox.actualTotalRunningSeconds,
      actualTotalPausedSeconds: sandbox.actualTotalPausedSeconds,
      
      // Persistence (plan-based)
      persistenceDays: sandbox.persistenceDays,
      persistenceExpiresAt: sandbox.persistenceExpiresAt ?? null,
      persistenceDaysRemaining: sandbox.persistenceDaysRemaining ?? null,
      autoPause: sandbox.autoPause ?? false,
      
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
      netProxyCountry: sandbox.netProxyCountry,
      networkProxy: sandbox.networkProxy ?? null
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
      totalRunningSeconds: sandboxData.totalRunningSeconds,
      actualTotalRunningSeconds: sandboxData.actualTotalRunningSeconds,
      actualTotalPausedSeconds: sandboxData.actualTotalPausedSeconds,
      persistenceDays: sandboxData.persistenceDays,
      persistenceExpiresAt: sandboxData.persistenceExpiresAt ?? null,
      persistenceDaysRemaining: sandboxData.persistenceDaysRemaining ?? null,
      autoPause: sandboxData.autoPause ?? false,
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
      netProxyCountry: sandboxData.netProxyCountry,
      networkProxy: sandboxData.networkProxy ?? null
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
   * Pause sandbox.
   * Default (sync): backend waits until paused (or failed) before returning; no client polling.
   * With isAsync: true, POST returns immediately; use waitUntilStatus(sandboxId, ['paused','failed']) to poll.
   */
  async pauseSandbox(sandboxId: string, opts?: { timeoutMs?: number; isAsync?: boolean }): Promise<void> {
    const body: Record<string, unknown> = {}
    if (opts?.isAsync === true) body.is_async = true

    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/pause' as any, {
      params: { path: { sandbox_id: sandboxId } },
      body: Object.keys(body).length > 0 ? body : undefined
    })

    if (response.error) {
      throw new Error(formatApiError('Failed to pause sandbox', response.error))
    }
    // Sync: backend already waited until paused. Async: caller may use waitUntilStatus.
  }

  /**
   * @deprecated Use {@link connectSandbox} instead for unified connect (handles running or paused).
   *
   * Resume sandbox. Default (sync): backend waits until running before returning.
   * With isAsync: true, POST returns immediately; use waitUntilStatus to poll.
   *
   * **Breaking change (v6):** signature changed from `(sandboxId, timeoutMs?)` to `(sandboxId, opts?)`.
   * Old positional callers must migrate: `resumeSandbox(id, { timeoutMs })`.
   */
  async resumeSandbox(sandboxId: string, opts?: { timeoutMs?: number; isAsync?: boolean }): Promise<void> {
    const body: Record<string, unknown> = {}
    if (opts?.isAsync === true) body.is_async = true

    const response = await this.client.POST('/v1/sandboxes/{sandbox_id}/resume' as any, {
      params: { path: { sandbox_id: sandboxId } },
      body: Object.keys(body).length > 0 ? body : undefined
    })

    if (response.error) {
      throw new Error(formatApiError('Failed to resume sandbox', response.error))
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
      totalRunningSeconds: sandboxData.totalRunningSeconds,
      actualTotalRunningSeconds: sandboxData.actualTotalRunningSeconds,
      actualTotalPausedSeconds: sandboxData.actualTotalPausedSeconds,
      persistenceDays: sandboxData.persistenceDays,
      persistenceExpiresAt: sandboxData.persistenceExpiresAt ?? null,
      persistenceDaysRemaining: sandboxData.persistenceDaysRemaining ?? null,
      autoPause: sandboxData.autoPause ?? false,
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
      netProxyCountry: sandboxData.netProxyCountry,
      networkProxy: sandboxData.networkProxy ?? null
    }
    
    return sandboxInfo
  }

  /**
   * Get available Scalebox Regions that have eligible clusters.
   *
   * This is a public API (no authentication required) to help users discover
   * available regions for locality-based scheduling.
   *
   * @returns List of available Scalebox Regions with their IDs and names
   *
   * @example
   * ```ts
   * const regions = await client.getScaleboxRegions()
   * console.log(regions) // [{ id: 'us-east', name: 'US East (N. Virginia)' }, ...]
   * ```
   */
  async getScaleboxRegions(): Promise<ScaleboxRegion[]> {
    const response = await this.client.GET('/v1/scalebox-regions')

    if (response.error) {
      throw new Error(`Failed to get scalebox regions: ${JSON.stringify(response.error)}`)
    }

    // Process response and convert snake_case to camelCase
    const processedResponse = this.processResponse(response) as any
    const regionsData = processedResponse.data?.data?.scaleboxRegions || []

    return regionsData.map((region: any) => ({
      id: region.id || region.region_id || '',
      name: region.name || region.region_name || region.id || ''
    }))
  }

  // ---------------------------------------------------------------------------
  // Template API
  // ---------------------------------------------------------------------------

  async listTemplates(filters?: TemplateListFilters): Promise<TemplateListResponse> {
    const params: Record<string, string> = {}
    if (filters?.usable === true) params.usable = 'true'
    if (filters?.status) params.status = filters.status
    if (filters?.visibility) params.visibility = filters.visibility
    if (filters?.name) params.name = filters.name
    const query = new URLSearchParams(params).toString()
    const path = query ? `/v1/templates?${query}` : '/v1/templates'
    const response = await this.client.GET(path as any)
    if (response.error) throw new Error(formatApiError('Failed to list templates', response.error))
    const processed = this.processResponse(response) as { data?: { data?: { templates?: unknown[]; total?: number } } }
    const data = processed.data?.data ?? {}
    return {
      templates: (data.templates ?? []).map((t: unknown) => convertKeysToCamelCase(t)) as TemplateInfo[],
      total: data.total ?? 0
    }
  }

  async getTemplate(templateId: string): Promise<TemplateInfo> {
    const response = await this.client.GET('/v1/templates/{template_id}' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to get template', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateInfo
  }

  async createTemplate(req: CreateTemplateRequest): Promise<TemplateInfo> {
    const body = convertKeysToSnakeCase(req)
    const response = await this.client.POST('/v1/templates' as any, { body })
    if (response.error) throw new Error(formatApiError('Failed to create template', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateInfo
  }

  async updateTemplate(templateId: string, req: UpdateTemplateRequest): Promise<TemplateInfo> {
    const body = convertKeysToSnakeCase(req)
    const response = await this.client.PUT('/v1/templates/{template_id}' as any, {
      params: { path: { template_id: templateId } },
      body
    })
    if (response.error) throw new Error(formatApiError('Failed to update template', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateInfo
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const response = await this.client.DELETE('/v1/templates/{template_id}' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to delete template', response.error))
  }

  async updateTemplateStatus(templateId: string, data: UpdateTemplateStatusRequest): Promise<TemplateInfo> {
    const body = convertKeysToSnakeCase(data)
    const response = await this.client.PUT('/v1/templates/{template_id}/status' as any, {
      params: { path: { template_id: templateId } },
      body
    })
    if (response.error) throw new Error(formatApiError('Failed to update template status', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateInfo
  }

  async validateTemplate(templateId: string): Promise<unknown> {
    const response = await this.client.POST('/v1/templates/{template_id}/validate' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to validate template', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return processed.data?.data
  }

  async getTemplateDockerfile(templateId: string): Promise<string> {
    const base = this.config.apiUrl.replace(/\/$/, '')
    const url = `${base}/v1/templates/${encodeURIComponent(templateId)}/dockerfile`
    const headers: Record<string, string> = { Accept: 'text/plain' }
    if (this.config.apiKey) headers['X-API-KEY'] = this.config.apiKey
    else if (this.config.accessToken) headers['Authorization'] = `Bearer ${this.config.accessToken}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to get template dockerfile: ${res.status} ${text}`)
    }
    return res.text()
  }

  async getTemplateChain(templateId: string): Promise<TemplateChainResponse> {
    const response = await this.client.GET('/v1/templates/{template_id}/chain' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to get template chain', response.error))
    const processed = this.processResponse(response) as { data?: { data?: { chain?: unknown[]; depth?: number } } }
    const data = processed.data?.data ?? {}
    return {
      chain: (data.chain ?? []).map((t: unknown) => convertKeysToCamelCase(t)),
      depth: data.depth ?? 0
    }
  }

  async getPrivateImageStorageUsage(): Promise<unknown> {
    const response = await this.client.GET('/v1/templates/storage-usage' as any)
    if (response.error) throw new Error(formatApiError('Failed to get storage usage', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return processed.data?.data
  }

  async shareTemplate(templateId: string, opts?: ShareTemplateRequest): Promise<TemplateInfo> {
    const body = opts ? convertKeysToSnakeCase(opts) : undefined
    const response = await this.client.POST('/v1/templates/{template_id}/share' as any, {
      params: { path: { template_id: templateId } },
      body
    })
    if (response.error) throw new Error(formatApiError('Failed to share template', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateInfo
  }

  async unshareTemplate(templateId: string): Promise<TemplateInfo> {
    const response = await this.client.POST('/v1/templates/{template_id}/unshare' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to unshare template', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateInfo
  }

  async validateCustomImage(req: ValidateCustomImageRequest): Promise<ValidateCustomImageResponse> {
    const body = convertKeysToSnakeCase(req)
    const response = await this.client.POST('/v1/templates/validate-custom-image' as any, { body })
    if (response.error) {
      const err = response.error as { valid?: boolean; data?: unknown; detail?: unknown }
      if (typeof err === 'object' && (err.valid === false || (err.data != null && typeof err.data === 'object'))) {
        return convertKeysToCamelCase(err.data ?? err) as ValidateCustomImageResponse
      }
      throw new Error(formatApiError('Failed to validate custom image', response.error))
    }
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as ValidateCustomImageResponse
  }

  async directImportTemplate(req: DirectImportTemplateRequest): Promise<DirectImportTemplateResponse> {
    const body = convertKeysToSnakeCase(req)
    const response = await this.client.POST('/v1/templates/import' as any, { body })
    if (response.error) throw new Error(formatApiError('Failed to start direct import', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as DirectImportTemplateResponse
  }

  async importExistingTemplate(templateId: string): Promise<{ message?: string }> {
    const response = await this.client.POST('/v1/templates/{template_id}/import' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to start template import', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as { message?: string }
  }

  async getTemplateImportStatus(templateId: string): Promise<TemplateImportStatusResponse> {
    const response = await this.client.GET('/v1/templates/{template_id}/import' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to get template import status', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as TemplateImportStatusResponse
  }

  async cancelTemplateImport(templateId: string): Promise<{ jobId: string; status: string; message?: string }> {
    const response = await this.client.DELETE('/v1/templates/{template_id}/import' as any, {
      params: { path: { template_id: templateId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to cancel template import', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as { jobId: string; status: string; message?: string }
  }

  async getImportJobByID(jobId: string): Promise<ImportJobInfo> {
    const response = await this.client.GET('/v1/import-jobs/{job_id}' as any, {
      params: { path: { job_id: jobId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to get import job', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as ImportJobInfo
  }

  async listImportJobs(opts?: ListImportJobsOpts): Promise<ListImportJobsResponse> {
    const params: Record<string, string> = {}
    if (opts?.limit != null) params.limit = String(opts.limit)
    if (opts?.offset != null) params.offset = String(opts.offset)
    if (opts?.status) params.status = opts.status
    if (opts?.templateId) params.template_id = opts.templateId
    const query = new URLSearchParams(params).toString()
    const path = query ? `/v1/import-jobs?${query}` : '/v1/import-jobs'
    const response = await this.client.GET(path as any)
    if (response.error) throw new Error(formatApiError('Failed to list import jobs', response.error))
    const processed = this.processResponse(response) as { data?: { data?: { jobs?: unknown[]; total?: number; limit?: number; offset?: number } } }
    const data = processed.data?.data ?? {}
    return {
      jobs: (data.jobs ?? []).map((j: unknown) => convertKeysToCamelCase(j)) as ImportJobInfo[],
      total: data.total ?? 0,
      limit: data.limit ?? 20,
      offset: data.offset ?? 0
    }
  }

  async cancelImportJob(jobId: string): Promise<{ jobId: string; status: string; message?: string }> {
    const response = await this.client.DELETE('/v1/import-jobs/{job_id}' as any, {
      params: { path: { job_id: jobId } }
    })
    if (response.error) throw new Error(formatApiError('Failed to cancel import job', response.error))
    const processed = this.processResponse(response) as { data?: { data?: unknown } }
    return convertKeysToCamelCase(processed.data?.data ?? {}) as { jobId: string; status: string; message?: string }
  }

  /**
   * Poll getTemplateImportStatus until status is completed, failed, or cancelled (or timeout).
   * Default timeout 10 min, interval 5 s.
   */
  async waitUntilImportComplete(
    templateId: string,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<TemplateImportStatusResponse> {
    const timeoutMs = opts?.timeoutMs ?? 600_000
    const intervalMs = opts?.intervalMs ?? 5000
    const deadline = Date.now() + timeoutMs
    const terminal = new Set(['completed', 'failed', 'cancelled'])
    while (Date.now() < deadline) {
      const status = await this.getTemplateImportStatus(templateId)
      if (terminal.has(status.status)) return status
      await new Promise(r => setTimeout(r, intervalMs))
    }
    const last = await this.getTemplateImportStatus(templateId)
    throw new Error(`Template import did not complete within ${timeoutMs}ms; last status: ${last.status}`)
  }

}