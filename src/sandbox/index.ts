import { ApiClient } from '../api'
import { ConnectionConfig, ConnectionOpts, DEFAULT_SANDBOX_TIMEOUT_MS } from '../connectionConfig'
import { 
  SandboxOpts, 
  SandboxInfo, 
  SandboxMetrics, 
  SandboxListOpts, 
  SandboxConnectOpts,
  SandboxQuery,
  SandboxUrlOpts,
  SandboxMetricsOpts
} from './types'
import { ScaleboxError, SandboxError, NotFoundError } from '../errors'
import { Filesystem } from './filesystem'
import { Commands } from './commands'
import { Pty } from './pty'
import { ProcessManager } from './process'
import { SandboxApi } from './sandboxApi'

/**
 * Scalebox cloud sandbox is a secure and isolated cloud environment.
 *
 * The sandbox allows you to:
 * - Access Linux OS
 * - Create, list, and delete files and directories
 * - Run commands
 * - Run isolated code
 * - Access the internet
 *
 * Check docs [here](https://scalebox.dev/docs).
 *
 * Use {@link Sandbox.create} to create a new sandbox.
 *
 * @example
 * ```ts
 * import { Sandbox } from '@scalebox/sdk'
 *
 * const sandbox = await Sandbox.create()
 * ```
 */
export class Sandbox {
  protected static readonly defaultTemplate: string = 'base'
  protected static readonly defaultSandboxTimeoutMs = DEFAULT_SANDBOX_TIMEOUT_MS

  /**
   * Module for interacting with the sandbox filesystem
   */
  readonly files: Filesystem
  /**
   * Module for running commands in the sandbox
   */
  readonly commands: Commands
  /**
   * Module for interacting with the sandbox pseudo-terminals
   */
  readonly pty: Pty
  /**
   * Module for managing sandbox processes
   */
  readonly processes: ProcessManager

  /**
   * Unique identifier of the sandbox.
   */
  readonly sandboxId: string

  /**
   * Domain where the sandbox is hosted.
   */
  readonly sandboxDomain: string

  /**
   * Access token for sandbox operations.
   */
  readonly envdAccessToken?: string

  protected readonly connectionConfig: ConnectionConfig
  protected readonly api: ApiClient
  private readonly envs: Record<string, string> = {}

  /**
   * Use {@link Sandbox.create} to create a new Sandbox instead.
   *
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(
    opts: SandboxConnectOpts & {
      sandboxId: string
      sandboxDomain: string
      envdAccessToken: string
      envs?: Record<string, string>
    }
  ) {
    this.connectionConfig = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    this.api = new ApiClient(this.connectionConfig, opts.sandboxId)

    this.sandboxId = opts.sandboxId
    this.sandboxDomain = opts.sandboxDomain
    this.envdAccessToken = opts.envdAccessToken
    this.envs = opts.envs || {}

    // Initialize filesystem, commands, pty, and process modules
    // Pass sandboxDomain directly to gRPC-based modules (Filesystem and ProcessManager)
    // sandboxDomain is the actual domain returned from sandbox creation API
    this.files = new Filesystem(this.sandboxId, this.connectionConfig, this.sandboxDomain, this.envdAccessToken)
    this.commands = new Commands(this.api, this.connectionConfig, this.sandboxId)
    this.pty = new Pty(this.api, this.connectionConfig, this.sandboxId)
    this.processes = new ProcessManager(this.sandboxId, this.connectionConfig, this.sandboxDomain, this.envdAccessToken)
  }

  /**
   * List all sandboxes.
   *
   * @param opts connection options.
   *
   * @returns paginator for listing sandboxes.
   */
  static list(opts?: SandboxListOpts): SandboxPaginator {
    return new SandboxPaginator(opts)
  }

  /**
   * Create a new sandbox from the default `code-interpreter` sandbox template.
   *
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * ```
   * @constructs {@link Sandbox}
   */
  static async create<S extends typeof Sandbox>(
    this: S,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>>

  /**
   * Create a new sandbox from the specified sandbox template.
   *
   * @param template sandbox template name or ID.
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('<template-name-or-id>')
   * ```
   * @constructs {@link Sandbox}
   */
  static async create<S extends typeof Sandbox>(
    this: S,
    template: string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(
    this: S,
    templateOrOpts?: SandboxOpts | string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>> {
    const { template, sandboxOpts } =
      typeof templateOrOpts === 'string'
        ? { template: templateOrOpts, sandboxOpts: opts }
        : { template: this.defaultTemplate, sandboxOpts: templateOrOpts }

    const config = new ConnectionConfig({
      apiKey: sandboxOpts?.apiKey,
      apiUrl: sandboxOpts?.apiUrl,
      debug: sandboxOpts?.debug,
      domain: sandboxOpts?.domain,
      requestTimeoutMs: sandboxOpts?.requestTimeoutMs,
      headers: sandboxOpts?.headers
    })
    if (config.debug) {
      return new this({
        sandboxId: 'debug_sandbox_id',
        sandboxDomain: 'debug.scalebox.dev',
        envdAccessToken: 'debug_token',
        ...config,
      }) as InstanceType<S>
    }

    const sandbox = await SandboxApi.createSandbox(
      template,
      sandboxOpts?.timeoutMs ?? this.defaultSandboxTimeoutMs,
      sandboxOpts
    )

    // SandboxApi.createSandbox validates and ensures these fields exist
    // The API will throw an error if sandboxDomain or envdAccessToken is missing
    const instance = new this({ 
      sandboxId: sandbox.sandboxId,
      sandboxDomain: sandbox.sandboxDomain as string,
      envdAccessToken: sandbox.envdAccessToken as string,
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      debug: config.debug,
      domain: config.domain,
      requestTimeoutMs: config.requestTimeoutMs,
      headers: config.headers
    }) as InstanceType<S>

    // Perform health check to ensure sandbox domain is accessible via ingress
    // This ensures the sandbox is fully ready before returning to the client
    try {
      await instance.waitForHealth({
        maxRetries: 50,
        retryInterval: 100,
        timeout: 5000
      })
    } catch (error) {
      // Don't throw - allow sandbox to be returned even if health check fails
      // The sandbox might still become available after a short delay
      console.warn(`[Sandbox ${sandbox.sandboxId}] Health check failed, sandbox may not be immediately accessible`)
    }

    return instance
  }

  /**
   * Connect to a sandbox. If the sandbox is paused, it will be automatically resumed.
   * Sandbox must be either running or be paused.
   *
   * With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns A running sandbox instance
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * const sandboxId = sandbox.sandboxId
   *
   * // Connect to the same sandbox.
   * const sameSandbox = await Sandbox.connect(sandboxId)
   * ```
   */
  static async connect<S extends typeof Sandbox>(
    this: S,
    sandboxId: string,
    opts?: SandboxConnectOpts
  ): Promise<InstanceType<S>> {
    try {
      await SandboxApi.setTimeout(
        sandboxId,
        opts?.timeoutMs || DEFAULT_SANDBOX_TIMEOUT_MS,
        opts
      )
    } catch (e) {
      if (e instanceof SandboxError) {
        await SandboxApi.resumeSandbox(sandboxId, opts)
      } else {
        throw e
      }
    }

    const info = await SandboxApi.getFullInfo(sandboxId, opts)

    // sandboxDomain 和 envdAccessToken 必须存在
    if (!info.sandboxDomain) {
      throw new ScaleboxError(`Failed to connect to sandbox ${sandboxId}: sandboxDomain not available`)
    }
    if (!info.envdAccessToken) {
      throw new ScaleboxError(`Failed to connect to sandbox ${sandboxId}: envdAccessToken not available`)
    }

    const config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })

    return new this({
      sandboxId,
      sandboxDomain: info.sandboxDomain,
      envdAccessToken: info.envdAccessToken,
      envs: info.envs,
      ...config,
    }) as InstanceType<S>
  }

  /**
   * Connect to a sandbox. If the sandbox is paused, it will be automatically resumed.
   * Sandbox must be either running or be paused.
   *
   * With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).
   *
   * @param opts connection options.
   *
   * @returns A running sandbox instance
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * await sandbox.betaPause()
   *
   * // Connect to the same sandbox.
   * const sameSandbox = await sandbox.connect()
   * ```
   */
  async connect(opts?: SandboxOpts): Promise<this> {
    try {
      await SandboxApi.setTimeout(
        this.sandboxId,
        opts?.timeoutMs || DEFAULT_SANDBOX_TIMEOUT_MS,
        opts
      )
    } catch (e) {
      await SandboxApi.resumeSandbox(this.sandboxId, opts)
    }

    return this
  }

  /**
   * Get the host address for the specified sandbox port.
   * You can then use this address to connect to the sandbox port from outside the sandbox via HTTP or WebSocket.
   *
   * @param port number of the port in the sandbox.
   *
   * @returns host address of the sandbox port.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * // Start an HTTP server
   * await sandbox.commands.exec('python3 -m http.server 3000')
   * // Get the hostname of the HTTP server
   * const serverURL = sandbox.getHost(3000)
   * ```
   */
  getHost(port: number) {
    if (this.connectionConfig.debug) {
      return `localhost:${port}`
    }

    return `${port}-${this.sandboxId}.${this.sandboxDomain}`
  }

  /**
   * Check if the sandbox is running.
   *
   * @returns `true` if the sandbox is running, `false` otherwise.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * await sandbox.isRunning() // Returns true
   *
   * await sandbox.kill()
   * await sandbox.isRunning() // Returns false
   * ```
   */
  async isRunning(
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<boolean> {
    try {
      const info = await this.getInfo()
      return info.status === 'running'
    } catch {
      return false
    }
  }

  /**
   * Set the timeout of the sandbox.
   * After the timeout expires the sandbox will be automatically killed.
   *
   * This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.setTimeout`.
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @param timeoutMs timeout in **milliseconds**.
   * @param opts connection options.
   */
  async setTimeout(
    timeoutMs: number,
    opts?: Pick<SandboxOpts, 'requestTimeoutMs'>
  ) {
    if (this.connectionConfig.debug) {
      // Skip timeout in debug mode
      return
    }

    await SandboxApi.setTimeout(this.sandboxId, timeoutMs, {
      ...this.connectionConfig,
      ...opts,
    })
  }

  /**
   * Kill the sandbox.
   *
   * @param opts connection options.
   */
  async kill(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    if (this.connectionConfig.debug) {
      // Skip killing in debug mode
      return
    }

    await SandboxApi.kill(this.sandboxId, { ...this.connectionConfig, ...opts })
  }

  /**
   * @beta This feature is in beta and may change in the future.
   *
   * Pause a sandbox by its ID.
   *
   * @param opts connection options.
   *
   * @returns sandbox ID that can be used to resume the sandbox.
   */
  async betaPause(opts?: ConnectionOpts): Promise<boolean> {
    return await SandboxApi.betaPause(this.sandboxId, opts)
  }

  /**
   * Get the URL to upload a file to the sandbox.
   *
   * You have to send a POST request to this URL with the file as multipart/form-data.
   *
   * @param path path to the file in the sandbox.
   *
   * @param opts upload url options.
   *
   * @returns URL for uploading file.
   */
  async uploadUrl(path?: string, opts?: SandboxUrlOpts) {
    const user = opts?.user || 'user'
    
    // Build the upload URL using sandboxDomain (which already includes the correct port)
    const baseUrl = `https://${this.sandboxDomain}`
    const url = new URL('/upload', baseUrl)
    
    // TODO: Implement signature-based authentication if needed
    // For now, we rely on the API key authentication via headers
    // This would be used for secure sandboxes in the future
    if (opts?.useSignatureExpiration !== undefined) {
      console.warn('Signature-based authentication not yet implemented. Using Bearer + X-Access-Token authentication.')
    }
    
    return url.toString()
  }

  /**
   * Get the URL to download a file from the sandbox.
   *
   * @param path path to the file in the sandbox.
   *
   * @param opts download url options.
   *
   * @returns URL for downloading file.
   */
  async downloadUrl(path: string, opts?: SandboxUrlOpts) {
    const user = opts?.user || 'user'
    
    // Build the download URL using sandboxDomain (which already includes the correct port)
    const baseUrl = `https://${this.sandboxDomain}`
    const cleanPath = path.replace(/^\/+/, '') // Remove leading slashes
    const url = new URL(`/download/${cleanPath}`, baseUrl)
    
    // TODO: Implement signature-based authentication if needed
    // For now, we rely on the API key authentication via headers
    // This would be used for secure sandboxes in the future
    if (opts?.useSignatureExpiration !== undefined) {
      console.warn('Signature-based authentication not yet implemented. Using Bearer + X-Access-Token authentication.')
    }
    
    return url.toString()
  }

  /**
   * Check if the sandbox is healthy and ready for operations.
   * This method performs a health check by calling the /health endpoint.
   *
   * @param opts health check options.
   *
   * @returns Promise that resolves when sandbox is healthy.
   *
   * @example
   * ```ts
   * await sandbox.waitForHealth()
   * console.log('Sandbox is ready!')
   * ```
   */
  async waitForHealth(opts?: { maxRetries?: number; retryInterval?: number; timeout?: number }) {
    const maxRetries = opts?.maxRetries || 50
    const retryInterval = opts?.retryInterval || 100
    const timeout = opts?.timeout || 5000
    
    const startTime = Date.now()
    
    // Build the health check URL using sandboxDomain
    const baseUrl = `https://${this.sandboxDomain}`
    const healthUrl = `${baseUrl}/health`
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if we've exceeded total timeout
      const elapsed = Date.now() - startTime
      if (elapsed > timeout) {
        throw new Error(`Health check timeout after ${elapsed}ms`)
      }
      
      try {
        // Build request headers
        const requestHeaders: Record<string, string> = {}
        
        // Add authorization if available
        if (this.envdAccessToken) {
          requestHeaders['X-Access-Token'] = this.envdAccessToken
        }
        
        // Make health check request to /health endpoint
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: requestHeaders,
          signal: AbortSignal.timeout(1000) // 1 second timeout for each health check
        })
        
        if (response.ok) {
          return
        }
      } catch (error) {
        // If it's not ready, wait and retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryInterval))
        }
      }
    }
    
    throw new Error(`Health check failed after ${maxRetries} attempts`)
  }

  /**
   * Upload a file from local filesystem to sandbox using the file upload URL.
   * This method provides a simple way to upload files without manually handling URLs.
   *
   * @param localPath path to the local file to upload.
   * @param remotePath path in the sandbox where the file should be uploaded.
   * @param opts upload options.
   *
   * @returns information about the uploaded file
   */
  async uploadFile(localPath: string, remotePath: string, opts?: { user?: string }) {
    return await this.files.uploadFile(localPath, remotePath, opts)
  }

  /**
   * Download a file from sandbox to local filesystem using the file download URL.
   * This method provides a simple way to download files without manually handling URLs.
   *
   * @param remotePath path to the file in the sandbox.
   * @param localPath path where the file should be saved locally.
   * @param opts download options.
   *
   * @returns information about the downloaded file
   */
  async downloadFile(remotePath: string, localPath: string, opts?: { user?: string }) {
    return await this.files.downloadFile(remotePath, localPath, opts)
  }

  /**
   * Get sandbox information like sandbox ID, template, metadata, started at/end at date.
   *
   * @param opts connection options.
   *
   * @returns information about the sandbox
   */
  async getInfo(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    return await SandboxApi.getInfo(this.sandboxId, {
      ...this.connectionConfig,
      ...opts,
    })
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param opts connection options.
   *
   * @returns  List of sandbox metrics containing CPU, memory and disk usage information.
   */
  async getMetrics(opts?: SandboxMetricsOpts) {
    return await SandboxApi.getMetrics(this.sandboxId, {
      ...this.connectionConfig,
      ...opts,
    })
  }
}

/**
 * Paginator for listing sandboxes.
 *
 * @example
 * ```ts
 * const paginator = Sandbox.list()
 *
 * while (paginator.hasNext) {
 *   const sandboxes = await paginator.nextItems()
 *   console.log(sandboxes)
 * }
 * ```
 */
export class SandboxPaginator {
  private _hasNext: boolean
  private _nextToken?: string

  private readonly config: ConnectionConfig
  private client: ApiClient

  private query: SandboxListOpts['query']
  private readonly limit?: number

  constructor(opts?: SandboxListOpts) {
    this.config = new ConnectionConfig({
      apiKey: opts?.apiKey,
      apiUrl: opts?.apiUrl,
      debug: opts?.debug,
      domain: opts?.domain,
      requestTimeoutMs: opts?.requestTimeoutMs,
      headers: opts?.headers
    })
    this.client = new ApiClient(this.config)

    this._hasNext = true
    this._nextToken = opts?.nextToken

    this.query = opts?.query
    this.limit = opts?.limit
  }

  /**
   * Returns True if there are more items to fetch.
   */
  get hasNext(): boolean {
    return this._hasNext
  }

  /**
   * Returns the next token to use for pagination.
   */
  get nextToken(): string | undefined {
    return this._nextToken
  }

  /**
   * Get the next page of sandboxes.
   *
   * @throws Error if there are no more items to fetch. Call this method only if `hasNext` is `true`.
   *
   * @returns List of sandboxes
   */
  async nextItems(): Promise<SandboxInfo[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    try {
      const result = await this.client.listSandboxes({
        query: this.query,
        limit: this.limit,
        nextToken: this.nextToken
      })

      this._nextToken = result.nextToken
      this._hasNext = !!this._nextToken

      return result.sandboxes
    } catch (error) {
      throw new ScaleboxError(`Failed to list sandboxes: ${error}`)
    }
  }
}