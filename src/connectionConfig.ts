/**
 * 连接配置
 * 支持完整的配置选项
 */

export const DEFAULT_SANDBOX_TIMEOUT_MS = 300_000 // 5 minutes
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000 // 30 seconds
export const DEFAULT_COMMAND_TIMEOUT_MS = 60_000 // 60 seconds
export const KEEPALIVE_PING_INTERVAL_SEC = 50 // 50 seconds
export const KEEPALIVE_PING_HEADER = 'Keepalive-Ping-Interval'

export interface ConnectionOpts {
  /**
   * API key for authentication
   */
  apiKey?: string
  
  /**
   * API URL
   */
  apiUrl?: string
  
  /**
   * Access token for authentication (envdAccessToken from sandbox creation)
   */
  accessToken?: string
  
  /**
   * Environment access token (alias for accessToken for compatibility)
   */
  envdAccessToken?: string
  
  /**
   * Request timeout in milliseconds
   */
  requestTimeoutMs?: number
  
  /**
   * Debug mode
   */
  debug?: boolean
  
  /**
   * Domain for the sandbox
   */
  domain?: string
  
  /**
   * Custom headers
   */
  headers?: Record<string, string>
  
  /**
   * Logger instance
   */
  logger?: {
    info?: (message: string, ...args: any[]) => void
    warn?: (message: string, ...args: any[]) => void
    error?: (message: string, ...args: any[]) => void
    debug?: (message: string, ...args: any[]) => void
  }
}

export interface ConnectionConfigOpts extends ConnectionOpts {}

export class ConnectionConfig {
  public readonly apiKey?: string
  public readonly accessToken?: string
  public readonly envdAccessToken?: string
  public readonly apiUrl: string
  public readonly requestTimeoutMs: number
  public readonly debug: boolean
  public readonly domain?: string
  public readonly headers: Record<string, string>
  public readonly logger?: ConnectionOpts['logger']

  constructor(opts: ConnectionConfigOpts = {}) {
    this.apiKey = opts.apiKey || process.env.SCALEBOX_API_KEY
    this.accessToken = opts.accessToken || opts.envdAccessToken || process.env.SCALEBOX_ACCESS_TOKEN || process.env.SCALEBOX_ENVD_ACCESS_TOKEN
    this.envdAccessToken = opts.envdAccessToken || opts.accessToken || process.env.SCALEBOX_ENVD_ACCESS_TOKEN || process.env.SCALEBOX_ACCESS_TOKEN
    this.apiUrl = opts.apiUrl || process.env.SCALEBOX_API_URL || 'https://api.scalebox.dev'
    
    // domain is optional - it will be provided by sandbox creation response
    // Do not set a default value here
    this.domain = opts.domain || process.env.SCALEBOX_DOMAIN
    
    this.requestTimeoutMs = opts.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
    this.debug = opts.debug || false
    this.headers = opts.headers || {}
    this.logger = opts.logger

    if (!this.apiKey && !this.accessToken && !this.envdAccessToken) {
      throw new Error('Either apiKey, accessToken, or envdAccessToken must be provided')
    }
    
    if (this.debug) {
      this.logger?.debug?.('ConnectionConfig initialized:', {
        hasApiKey: !!this.apiKey,
        hasAccessToken: !!this.accessToken,
        hasEnvdAccessToken: !!this.envdAccessToken,
        apiUrl: this.apiUrl,
        domain: this.domain
      })
    }
  }

  /**
   * Get signal for request timeout
   */
  getSignal(timeoutMs?: number): AbortSignal {
    const controller = new AbortController()
    const timeout = timeoutMs || this.requestTimeoutMs
    
    setTimeout(() => {
      controller.abort()
    }, timeout)
    
    return controller.signal
  }
}