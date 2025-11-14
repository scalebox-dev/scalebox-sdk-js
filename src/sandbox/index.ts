import { ApiClient } from '../api'
import { GrpcClient } from '../grpc'
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
import type { CodeExecutionOpts, ExecutionResult, Language } from '../code-interpreter'
import { getSignature } from './signature'

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
   * 
   * @internal
   * This property is used internally for authentication with sandbox services.
   * It should not be accessed directly in normal usage. Modifying this value
   * may cause unexpected behavior.
   * 
   * Similar to AWS SDK's internal credentials, this is exposed for advanced
   * use cases and internal modules but is not part of the stable public API.
   */
  readonly envdAccessToken?: string

  protected readonly connectionConfig: ConnectionConfig
  protected readonly api: ApiClient
  protected readonly grpcClient: GrpcClient
  private readonly envs: Record<string, string> = {}
  private codeInterpreter?: any // Lazy-loaded CodeInterpreter instance

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

    // Initialize gRPC client for sandbox communication
    // The grpcClient uses sandboxDomain and envdAccessToken for authentication
    this.grpcClient = new GrpcClient(
      this.connectionConfig,
      this.sandboxDomain,
      this.envdAccessToken
    )

    // Initialize filesystem, commands, pty, and process modules
    // Commands and Pty now use gRPC client for process management
    this.files = new Filesystem(this.sandboxId, this.connectionConfig, this.sandboxDomain, this.envdAccessToken)
    this.commands = new Commands(this.grpcClient, this.connectionConfig)
    this.pty = new Pty(this.grpcClient, this.connectionConfig)
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
        ...sandboxOpts,
        sandboxId: 'debug_sandbox_id',
        sandboxDomain: 'debug.scalebox.dev',
        envdAccessToken: 'debug_token',
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
      ...sandboxOpts,
      sandboxId: sandbox.sandboxId,
      sandboxDomain: sandbox.sandboxDomain as string,
      envdAccessToken: sandbox.envdAccessToken as string,
    }) as InstanceType<S>

    // Perform health check to ensure sandbox domain is accessible via ingress
    // This ensures the sandbox is fully ready before returning to the client
    try {
      await instance.waitForHealth({
        maxRetries: 100,
        retryInterval: 200,
        timeout: 10000
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
   * @param opts.timeoutMs - Optional timeout in milliseconds. If not provided, the existing sandbox timeout will be preserved.
   *
   * @returns A running sandbox instance
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * const sandboxId = sandbox.sandboxId
   *
   * // Connect to the same sandbox (preserves existing timeout).
   * const sameSandbox = await Sandbox.connect(sandboxId)
   * 
   * // Connect with extended timeout
   * const extendedSandbox = await Sandbox.connect(sandboxId, { timeoutMs: 600000 })
   * ```
   */
  static async connect<S extends typeof Sandbox>(
    this: S,
    sandboxId: string,
    opts?: SandboxConnectOpts
  ): Promise<InstanceType<S>> {
    // Use unified connect endpoint: backend automatically handles running or paused sandboxes
    // If sandbox is running, returns info immediately; if paused, automatically resumes
    const info = await SandboxApi.connectSandbox(sandboxId, opts)

    // sandboxDomain and envdAccessToken must exist
    if (!info.sandboxDomain) {
      throw new ScaleboxError(`Failed to connect to sandbox ${sandboxId}: sandboxDomain not available`)
    }
    if (!info.envdAccessToken) {
      throw new ScaleboxError(`Failed to connect to sandbox ${sandboxId}: envdAccessToken not available`)
    }

    return new this({
      ...opts,
      sandboxId,
      sandboxDomain: info.sandboxDomain,
      envdAccessToken: info.envdAccessToken,
      envs: info.envs,
    }) as InstanceType<S>
  }

  /**
   * Connect to a sandbox. If the sandbox is paused, it will be automatically resumed.
   * Sandbox must be either running or be paused.
   *
   * With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).
   *
   * @param opts connection options.
   * @param opts.timeoutMs - Optional timeout in milliseconds. If not provided, the existing sandbox timeout will be preserved.
   *
   * @returns A running sandbox instance
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * await sandbox.betaPause()
   *
   * // Connect to the same sandbox (preserves existing timeout).
   * const sameSandbox = await sandbox.connect()
   * 
   * // Connect with extended timeout
   * await sandbox.connect({ timeoutMs: 600000 })
   * ```
   */
  async connect(opts?: SandboxOpts): Promise<this> {
    // Use unified connect endpoint: backend automatically handles running or paused sandboxes
    // If sandbox is running, returns info immediately; if paused, automatically resumes
    await SandboxApi.connectSandbox(this.sandboxId, opts)

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
   * Check if the sandbox is running by performing a direct health check.
   * 
   * This method directly probes the sandbox agent's health endpoint,
   * providing real-time and accurate status information. It automatically
   * handles various failure scenarios including:
   * - Sandbox timeout/expiration
   * - Network connectivity issues
   * - Sandbox crashes or failures
   *
   * @param opts connection options including request timeout
   * @returns `true` if the sandbox is running and responsive, `false` otherwise.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * await sandbox.isRunning() // Returns true
   *
   * await sandbox.kill()
   * await sandbox.isRunning() // Returns false
   * 
   * // Custom timeout
   * await sandbox.isRunning({ requestTimeoutMs: 10000 })
   * ```
   */
  async isRunning(
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<boolean> {
    // If sandbox domain is not available, fall back to API-based status check
    if (!this.sandboxDomain) {
      try {
        const info = await this.getInfo()
        return info.status === 'running'
      } catch {
        return false
      }
    }

    try {
      // Direct health check approach for real-time accuracy
      // This probes the sandbox directly rather than relying on database state
      const timeoutMs = opts?.requestTimeoutMs || 5000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const healthUrl = `https://${this.sandboxDomain}/health`
        
        // Build request headers (auth is optional, similar to waitForHealth)
        const requestHeaders: Record<string, string> = {}
        if (this.envdAccessToken) {
          requestHeaders['X-Access-Token'] = this.envdAccessToken
        }

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: requestHeaders
        })

        clearTimeout(timeoutId)
        
        // 502 Bad Gateway means sandbox is not reachable (nginx upstream unavailable)
        if (response.status === 502) {
          return false
        }

        // Any 2xx response means sandbox is healthy and running
        return response.ok
      } catch (error: any) {
        clearTimeout(timeoutId)
        
        // Network errors, timeouts, or aborts mean sandbox is not running
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          return false
        }
        
        // Other fetch errors (network issues, DNS failures, etc.)
        return false
      }
    } catch {
      // Fallback: any unexpected error means sandbox is not running
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
   * @param path path to the file in the sandbox (optional, can be provided in form data).
   *
   * @param opts upload url options.
   *
   * @returns URL for uploading file.
   */
  async uploadUrl(path?: string, opts?: SandboxUrlOpts) {
    const baseUrl = `https://${this.sandboxDomain}`
    const url = new URL('/upload', baseUrl)
    
    if (path) {
      url.searchParams.set('path', path)
    }
    
    // Generate signature if envdAccessToken is available (consistent with Python SDK)
    // If useSignatureExpiration is provided, use it; otherwise generate signature without expiration
    if (this.envdAccessToken) {
      this.addSignatureToUrl(url, path || '/', 'write', opts || {})
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
    const baseUrl = `https://${this.sandboxDomain}`
    const cleanPath = path.replace(/^\/+/, '')
    const url = new URL(`/download/${cleanPath}`, baseUrl)
    
    // Generate signature if envdAccessToken is available (consistent with Python SDK)
    // If useSignatureExpiration is provided, use it; otherwise generate signature without expiration
    if (this.envdAccessToken) {
      this.addSignatureToUrl(url, path, 'read', opts || {})
    }
    
    return url.toString()
  }

  /**
   * Add signature parameters to URL for secure file access.
   * 
   * @private
   */
  private addSignatureToUrl(
    url: URL,
    path: string,
    operation: 'read' | 'write',
    opts: SandboxUrlOpts
  ): void {
    if (!this.envdAccessToken) {
      throw new ScaleboxError(
        'Cannot generate signed URL: envdAccessToken is not available. Signed URLs require an access token.'
      )
    }

    // Normalize path to match backend expectations:
    // - Remove all leading slashes, then add a single leading slash
    // - This ensures consistency with backend path extraction logic
    //   Backend extracts download path using: strings.TrimPrefix(urlPath, "/download")
    //   Backend extracts upload path from query parameter "path"
    const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '/'
    // Use 'root' as default user to match Filesystem default and ensure user exists in system
    const user = opts.user || 'root'
    const signature = getSignature(
      normalizedPath,
      operation,
      user,
      this.envdAccessToken,
      opts.useSignatureExpiration
    )

    url.searchParams.set('signature', signature.signature)
    if (signature.expiration !== null) {
      url.searchParams.set('signature_expiration', signature.expiration.toString())
    }
    url.searchParams.set('username', user)
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
          signal: AbortSignal.timeout(2000) // 2 second timeout for each health check
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

  /**
   * Execute code in the sandbox using the code interpreter.
   * This is a convenience method that wraps CodeInterpreter functionality.
   *
   * @param code code to execute.
   * @param opts execution options including language and context.
   *
   * @returns execution result containing stdout, stderr, exit code, and more.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('code-interpreter')
   * const result = await sandbox.runCode("print('Hello World')", { 
   *   language: 'python' 
   * })
   * console.log(result.text) // "Hello World\n"
   * ```
   */
  async runCode(
    code: string,
    opts: Omit<CodeExecutionOpts, 'code'> & { language: Language }
  ): Promise<ExecutionResult> {
    // Lazy-load CodeInterpreter
    if (!this.codeInterpreter) {
      // Import CodeInterpreter dynamically to avoid circular dependencies
      const { CodeInterpreter } = await import('../code-interpreter')
      this.codeInterpreter = new CodeInterpreter(this, this.connectionConfig, this.api)
    }

    return await this.codeInterpreter.runCode(code, opts)
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