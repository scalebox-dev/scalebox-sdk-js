import { ApiClient } from '../api'
import { ConnectionConfig, DEFAULT_SANDBOX_TIMEOUT_MS } from '../connectionConfig'
import { ScaleboxError, SandboxError, NotFoundError } from '../errors'
import type { SandboxInfo } from './types'

/**
 * Options for request to the Sandbox API.
 */
export interface SandboxApiOpts {
  apiKey?: string
  headers?: Record<string, string>
  debug?: boolean
  domain?: string
  requestTimeoutMs?: number
  apiUrl?: string
}

/**
 * Options for creating a new Sandbox.
 */
export interface SandboxOpts extends SandboxApiOpts {
  /**
   * Custom metadata for the sandbox.
   *
   * @default {}
   */
  metadata?: Record<string, string>

  /**
   * Custom environment variables for the sandbox.
   *
   * Used when executing commands and code in the sandbox.
   * Can be overridden with the `envs` argument when executing commands or code.
   *
   * @default {}
   */
  envs?: Record<string, string>

  /**
   * Timeout for the sandbox in **milliseconds**.
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @default 300_000 // 5 minutes
   */
  timeoutMs?: number

  /**
   * Template ID for the sandbox.
   *
   * @default 'code-interpreter'
   */
  templateId?: string

  /**
   * Allow sandbox to access the internet.
   *
   * @default true
   */
  allowInternetAccess?: boolean

  /**
   * Secure all system communication with sandbox.
   *
   * @default true
   */
  secure?: boolean

  /**
   * Automatically pause the sandbox after the timeout expires.
   *
   * @default false
   */
  autoPause?: boolean
}

export type SandboxBetaCreateOpts = SandboxOpts & {
  /**
   * Automatically pause the sandbox after the timeout expires.
   * @default false
   */
  autoPause?: boolean
}

/**
 * Options for connecting to a Sandbox.
 */
export interface SandboxConnectOpts extends SandboxApiOpts {
  sandboxId?: string
  timeoutMs?: number
  envs?: Record<string, string>
}

/**
 * State of the sandbox.
 */
export type SandboxState = 'running' | 'paused'

export interface SandboxListOpts {
  apiKey?: string
  headers?: Record<string, string>
  debug?: boolean
  domain?: string
  requestTimeoutMs?: number
  apiUrl?: string
  /**
   * Filter the list of sandboxes, e.g. by metadata `metadata:{"key": "value"}`, if there are multiple filters they are combined with AND.
   *
   */
  query?: {
    metadata?: Record<string, string>
    /**
     * Filter the list of sandboxes by state.
     * @default ['running', 'paused']
     */
    status?: Array<SandboxState>
  }

  /**
   * Number of sandboxes to return per page.
   *
   * @default 100
   */
  limit?: number

  /**
   * Token to the next page.
   */
  nextToken?: string
}

export interface SandboxMetricsOpts {
  apiKey?: string
  headers?: Record<string, string>
  debug?: boolean
  domain?: string
  requestTimeoutMs?: number
  apiUrl?: string
  /**
   * Start time for the metrics, defaults to the start of the sandbox
   */
  start?: string | Date
  /**
   * End time for the metrics, defaults to the current time
   */
  end?: string | Date
}


/**
 * Sandbox resource usage metrics.
 */
export interface SandboxMetrics {
  /**
   * Timestamp of the metrics.
   */
  timestamp: Date

  /**
   * CPU usage in percentage.
   */
  cpuUsedPct: number

  /**
   * Number of CPU cores.
   */
  cpuCount: number

  /**
   * Memory usage in bytes.
   */
  memUsed: number

  /**
   * Total memory available in bytes.
   */
  memTotal: number

  /**
   * Used disk space in bytes.
   */
  diskUsed: number

  /**
   * Total disk space available in bytes.
   */
  diskTotal: number
}

export class SandboxApi {
  protected constructor() {}

  /**
   * Kill the sandbox specified by sandbox ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns `true` if the sandbox was found and killed, `false` otherwise.
   */
  static async kill(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config, sandboxId)

    try {
      await client.deleteSandbox(sandboxId)
      return true
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false
      }
      throw error
    }
  }

  /**
   * Get sandbox information like sandbox ID, template, metadata, started at/end at date.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns sandbox information.
   */
  static async getInfo(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<SandboxInfo> {
    const fullInfo = await this.getFullInfo(sandboxId, opts)
    delete (fullInfo as any).envdAccessToken
    delete (fullInfo as any).sandboxDomain

    return fullInfo
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param sandboxId sandbox ID.
   * @param opts sandbox metrics options.
   *
   * @returns  List of sandbox metrics containing CPU, memory and disk usage information.
   */
  static async getMetrics(
    sandboxId: string,
    opts?: SandboxMetricsOpts
  ): Promise<SandboxMetrics[]> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config, sandboxId)

    try {
      const metrics = await client.getSandboxMetrics(sandboxId)
      return [metrics]
    } catch (error) {
      throw new ScaleboxError(`Failed to get sandbox metrics: ${error}`)
    }
  }

  /**
   * Set the timeout of the specified sandbox.
   * After the timeout expires the sandbox will be automatically killed.
   *
   * This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to {@link Sandbox.setTimeout}.
   *
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @param sandboxId sandbox ID.
   * @param timeoutMs timeout in **milliseconds**.
   * @param opts connection options.
   */
  static async setTimeout(
    sandboxId: string,
    timeoutMs: number,
    opts?: SandboxApiOpts
  ): Promise<void> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config, sandboxId)

    // Validate timeout before making API call
    const timeoutSeconds = Math.floor(timeoutMs / 1000)
    
    if (timeoutSeconds < 60) {
      throw new ScaleboxError(`Timeout must be at least 60 seconds (${timeoutSeconds}s provided, from ${timeoutMs}ms)`)
    }
    
    if (timeoutSeconds > 3600) {
      throw new ScaleboxError(`Timeout cannot exceed 3600 seconds (${timeoutSeconds}s provided, from ${timeoutMs}ms)`)
    }

    try {
      await client.updateSandboxTimeout(sandboxId, timeoutMs)
    } catch (error) {
      throw new ScaleboxError(`Failed to set sandbox timeout: ${error}`)
    }
  }

  static async getFullInfo(sandboxId: string, opts?: SandboxApiOpts): Promise<SandboxInfo> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config, sandboxId)

    try {
      // 直接返回统一的SandboxInfo结构
      const sandboxInfo = await client.getSandbox(sandboxId)
      
      return {
        ...sandboxInfo,
      }
    } catch (error) {
      throw new NotFoundError(`Sandbox ${sandboxId} not found`)
    }
  }

  /**
   * Pause the sandbox specified by sandbox ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns `true` if the sandbox got paused, `false` if the sandbox was already paused.
   */
  static async betaPause(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config, sandboxId)

    try {
      await client.pauseSandbox(sandboxId)
      return true
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Sandbox ${sandboxId} not found`)
      }
      throw error
    }
  }

  static async createSandbox(
    template: string,
    timeoutMs: number,
    opts?: SandboxBetaCreateOpts
  ): Promise<SandboxInfo> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config)

    const timeoutSeconds = Math.floor(timeoutMs / 1000) // Convert ms to seconds for API
    
    if (timeoutSeconds < 60) {
      throw new ScaleboxError(`Timeout must be at least 60 seconds (${timeoutSeconds}s provided, from ${timeoutMs}ms)`)
    }
    
    if (timeoutSeconds > 3600) {
      throw new ScaleboxError(`Timeout cannot exceed 3600 seconds (${timeoutSeconds}s provided, from ${timeoutMs}ms)`)
    }

    try {
      // 使用标准的 camelCase 接口
      const sandboxInfo = await client.createSandbox({
        template: template,
        timeout: timeoutSeconds,
        metadata: opts?.metadata || {},
        envVars: opts?.envs || {},
        allowInternetAccess: opts?.allowInternetAccess ?? true,
        secure: opts?.secure ?? true,
        autoPause: opts?.autoPause ?? false,
        isAsync: false // 默认同步创建
      })

      // sandboxDomain 必须由 API 返回，不允许降级
      if (!sandboxInfo.sandboxDomain) {
        throw new ScaleboxError('Sandbox creation failed: sandboxDomain not returned from API')
      }

      // envdAccessToken 必须由 API 返回，用于 gRPC 认证
      if (!sandboxInfo.envdAccessToken) {
        throw new ScaleboxError('Sandbox creation failed: envdAccessToken not returned from API')
      }

      // Return the full sandbox info
      return sandboxInfo
    } catch (error) {
      throw new ScaleboxError(`Failed to create sandbox: ${error}`)
    }
  }

  static async resumeSandbox(
    sandboxId: string,
    opts?: SandboxConnectOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config, sandboxId)

    // 恢复时需要传入 timeout，避免因暂停时间过长导致恢复后立即超时
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS

    try {
      await client.resumeSandbox(sandboxId, timeoutMs)
      return true
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Paused sandbox ${sandboxId} not found`)
      }
      throw error
    }
  }
}
