import { ApiClient } from '../api'
import { ConnectionConfig, DEFAULT_SANDBOX_TIMEOUT_MS } from '../connectionConfig'
import { ScaleboxError, SandboxError, NotFoundError } from '../errors'
import type { SandboxInfo, ObjectStorageConfig, LocalityConfig, ScaleboxRegion } from './types'

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

  /**
   * Object storage mount configuration for S3-compatible storage.
   * 
   * When provided, the specified S3 bucket will be mounted to the sandbox
   * at the specified mount point using FUSE.
   * 
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('base', {
   *   objectStorage: {
   *     uri: 's3://my-bucket/data/',
   *     mountPoint: '/mnt/oss',
   *     accessKey: 'YOUR_ACCESS_KEY',
   *     secretKey: 'YOUR_SECRET_KEY',
   *     region: 'ap-east-1',
   *     endpoint: 'https://s3.ap-east-1.amazonaws.com'
   *   }
   * })
   * ```
   */
  objectStorage?: ObjectStorageConfig

  /**
   * Network proxy country for sandbox traffic routing.
   * 
   * When provided, sandbox network traffic will be routed through a proxy
   * in the specified country.
   * 
   * Supported values: united-states, canada, japan, malaysia, brazil, france, italy, china, hong-kong
   * 
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('base', {
   *   netProxyCountry: 'united-states'
   * })
   * ```
   */
  netProxyCountry?: 'united-states' | 'canada' | 'japan' | 'malaysia' | 'brazil' | 'france' | 'italy' | 'china' | 'hong-kong'

  /**
   * Locality preferences for sandbox scheduling.
   * 
   * Controls where the sandbox will be scheduled based on geographical preferences.
   * By default, locality is disabled and the system uses load-balanced scheduling.
   * 
   * @example
   * ```ts
   * // Auto-detect region from source IP
   * const sandbox = await Sandbox.create('base', {
   *   locality: {
   *     autoDetect: true
   *   }
   * })
   * 
   * // Specify a preferred region (best-effort, allows fallback)
   * const sandbox = await Sandbox.create('base', {
   *   locality: {
   *     region: 'us-east'
   *   }
   * })
   * 
   * // WARNING: Hard constraint - will fail if region unavailable
   * const sandbox = await Sandbox.create('base', {
   *   locality: {
   *     region: 'us-east',
   *     force: true  // Use with caution - may cause creation failures
   *   }
   * })
   * ```
   */
  locality?: LocalityConfig
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
 * @deprecated Use SandboxQuery.status instead for more complete state support
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
   * Note: Backend API accepts a single status string, but SDK accepts an array for convenience.
   * If multiple statuses are provided, only the first one will be used.
   */
  query?: {
    metadata?: Record<string, string>
    /**
     * Filter the list of sandboxes by state.
     * Supported states: created, starting, running, pausing, paused, resuming, terminating, terminated, failed
     * @default ['running', 'paused']
     */
    status?: Array<'created' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'terminating' | 'terminated' | 'failed'>
    /**
     * Filter by template ID
     */
    templateId?: string
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
      // Return unified SandboxInfo structure directly
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
      // Use standard camelCase interface
      const sandboxInfo = await client.createSandbox({
        template: template,
        timeout: timeoutSeconds,
        metadata: opts?.metadata || {},
        envVars: opts?.envs || {},
        allowInternetAccess: opts?.allowInternetAccess ?? true,
        secure: opts?.secure ?? true,
        autoPause: opts?.autoPause ?? false,
        isAsync: false, // Default to synchronous creation
        objectStorage: opts?.objectStorage, // Pass through object storage configuration
        netProxyCountry: opts?.netProxyCountry, // Pass through network proxy country configuration
        locality: opts?.locality // Pass through locality configuration
      })

      // sandboxDomain must be returned by API, no fallback allowed
      if (!sandboxInfo.sandboxDomain) {
        throw new ScaleboxError('Sandbox creation failed: sandboxDomain not returned from API')
      }

      // envdAccessToken must be returned by API, used for gRPC authentication
      if (!sandboxInfo.envdAccessToken) {
        throw new ScaleboxError('Sandbox creation failed: envdAccessToken not returned from API')
      }

      // Return the full sandbox info
      return sandboxInfo
    } catch (error) {
      throw new ScaleboxError(`Failed to create sandbox: ${error}`)
    }
  }

  /**
   * @deprecated This method is deprecated, please use {@link connectSandbox} instead
   * 
   * Resume a paused sandbox
   * 
   * It is recommended to use {@link connectSandbox} method, which can:
   * - Automatically handle running or paused sandboxes
   * - Support optional timeout parameter
   * - Provide a cleaner API
   * 
   * @param sandboxId sandbox ID
   * @param opts connection options
   * @returns `true` if resume succeeded
   * 
   * @example
   * ```ts
   * // ❌ Not recommended: using deprecated resumeSandbox
   * await SandboxApi.resumeSandbox(sandboxId)
   * 
   * // ✅ Recommended: use unified connect endpoint
   * await SandboxApi.connectSandbox(sandboxId, { timeoutMs: 600000 })
   * ```
   * 
   * @see {@link connectSandbox} - Recommended unified connect endpoint
   */
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

    try {
      // Note: backend resume endpoint does not accept timeout parameter
      // Timeout is automatically calculated by backend state machine based on pause duration
      // If you need to set timeout, use connect endpoint or setTimeout method
      await client.resumeSandbox(sandboxId)
      return true
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Paused sandbox ${sandboxId} not found`)
      }
      throw error
    }
  }

  /**
   * Connect to a sandbox using the unified connect endpoint.
   * If the sandbox is running, returns sandbox info immediately.
   * If the sandbox is paused, automatically resumes it and waits for completion.
   * 
   * This is the recommended way to connect to sandboxes, as it handles both
   * running and paused states automatically.
   * 
   * @param sandboxId sandbox ID
   * @param opts connection options
   * @returns sandbox information with sandboxDomain and envdAccessToken
   */
  static async connectSandbox(
    sandboxId: string,
    opts?: SandboxConnectOpts
  ): Promise<SandboxInfo> {
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
      // Use unified endpoint: if sandbox is running, return immediately; if paused, automatically resume
      // timeout is optional: if not provided, backend will preserve existing timeout or use default value
      const sandboxInfo = await client.connectSandbox(
        sandboxId,
        opts?.timeoutMs
      )

      return sandboxInfo
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Sandbox ${sandboxId} not found`)
      }
      throw error
    }
  }

  /**
   * Create a template from a running sandbox.
   * 
   * @param sandboxId sandbox ID (must be in running state)
   * @param opts template creation options
   * @returns created template information
   */
  static async createTemplateFromSandbox(
    sandboxId: string,
    opts: {
      name: string
      description?: string
      visibility?: 'private' | 'account_shared' | 'public'
      cpuCount?: number
      memoryMB?: number
      ports?: string // JSON string of port configurations
      resetPorts?: boolean
      customCommand?: string
      readyCommand?: string
    } & SandboxApiOpts
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
      return await client.createTemplateFromSandbox(sandboxId, {
        name: opts.name,
        description: opts.description,
        visibility: opts.visibility,
        cpuCount: opts.cpuCount,
        memoryMB: opts.memoryMB,
        ports: opts.ports,
        resetPorts: opts.resetPorts,
        customCommand: opts.customCommand,
        readyCommand: opts.readyCommand
      })
    } catch (error) {
      throw new ScaleboxError(`Failed to create template from sandbox: ${error}`)
    }
  }

  /**
   * Get available Scalebox Regions that have eligible clusters.
   *
   * This is a public API (no authentication required) to help users discover
   * available regions for locality-based scheduling.
   *
   * @param opts connection options
   * @returns List of available Scalebox Regions with their IDs and names
   *
   * @example
   * ```ts
   * const regions = await SandboxApi.getScaleboxRegions()
   * console.log(regions) // [{ id: 'us-east', name: 'US East (N. Virginia)' }, ...]
   *
   * // Use a region when creating a sandbox
   * const sandbox = await Sandbox.create('base', {
   *   locality: {
   *     region: regions[0].id
   *   }
   * })
   * ```
   */
  static async getScaleboxRegions(opts?: SandboxApiOpts): Promise<ScaleboxRegion[]> {
    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    const client = new ApiClient(config)

    try {
      return await client.getScaleboxRegions()
    } catch (error) {
      throw new ScaleboxError(`Failed to get scalebox regions: ${error}`)
    }
  }
}
