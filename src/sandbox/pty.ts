import { ApiClient } from '../api'
import { ConnectionConfig } from '../connectionConfig'

/**
 * Options for request to the Pty API.
 */
export interface PtyRequestOpts {
  /**
   * Request timeout in milliseconds.
   */
  requestTimeoutMs?: number
}

/**
 * Options for starting a new pseudo-terminal.
 */
export interface PtyStartOpts extends PtyRequestOpts {
  /**
   * Working directory for the pseudo-terminal.
   */
  cwd?: string
  /**
   * User to run the pseudo-terminal as.
   */
  user?: string
  /**
   * Environment variables for the pseudo-terminal.
   */
  envs?: Record<string, string>
  /**
   * Callback for pseudo-terminal output.
   */
  onData?: (data: Uint8Array) => void | Promise<void>
  /**
   * Timeout for the pseudo-terminal in **milliseconds**.
   */
  timeoutMs?: number
}

/**
 * Options for connecting to a pseudo-terminal.
 */
export type PtyConnectOpts = Pick<PtyStartOpts, 'onData' | 'timeoutMs'>

/**
 * Pseudo-terminal handle.
 */
export class PtyHandle {
  private _data = ''
  private readonly _wait: Promise<void>

  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<boolean>,
    private readonly onData?: (data: Uint8Array) => void | Promise<void>
  ) {
    this._wait = this.handleEvents()
  }

  /**
   * Pseudo-terminal output data.
   */
  get data(): string {
    return this._data
  }

  /**
   * Wait for the pseudo-terminal to finish.
   */
  async wait(): Promise<void> {
    await this._wait
  }

  /**
   * Kill the pseudo-terminal.
   *
   * @returns `true` if the pseudo-terminal was killed, `false` otherwise.
   */
  async kill(): Promise<boolean> {
    return await this.handleKill()
  }

  /**
   * Send data to the pseudo-terminal.
   *
   * @param data data to send.
   */
  async send(data: string | Uint8Array): Promise<void> {
    // TODO: Implement sending data to pseudo-terminal
    throw new Error('Sending data to pseudo-terminal not implemented yet')
  }

  private async handleEvents(): Promise<void> {
    // TODO: Implement event handling for pseudo-terminal
    // This would typically involve listening to data streams
    // and updating the internal state accordingly
  }
}

/**
 * Module for interacting with the sandbox pseudo-terminals.
 */
export class Pty {
  private readonly api: ApiClient
  private readonly connectionConfig: ConnectionConfig
  private readonly sandboxId: string

  constructor(
    api: ApiClient,
    connectionConfig: ConnectionConfig,
    sandboxId: string
  ) {
    this.api = api
    this.connectionConfig = connectionConfig
    this.sandboxId = sandboxId
  }

  /**
   * Start a new pseudo-terminal.
   *
   * @param opts options for starting the pseudo-terminal.
   *
   * @returns handle to interact with the pseudo-terminal.
   */
  async start(opts?: PtyStartOpts): Promise<PtyHandle> {
    try {
      // TODO: Implement pseudo-terminal creation
      const pid = Math.floor(Math.random() * 10000) + 1000

      return new PtyHandle(
        pid,
        () => {}, // handleDisconnect
        async () => true, // handleKill
        opts?.onData
      )
    } catch (error) {
      throw new Error(`Failed to start pseudo-terminal: ${error}`)
    }
  }

  /**
   * Connect to a running pseudo-terminal by its process ID.
   *
   * @param pid process ID of the pseudo-terminal.
   * @param opts options for connecting to the pseudo-terminal.
   *
   * @returns handle to interact with the pseudo-terminal.
   */
  async connect(
    pid: number,
    opts?: PtyConnectOpts
  ): Promise<PtyHandle> {
    // TODO: Implement connection to existing pseudo-terminal
    throw new Error('Connecting to existing pseudo-terminals not implemented yet')
  }
}
