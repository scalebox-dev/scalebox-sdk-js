import { GrpcClient } from '../grpc/client'
import { ConnectionConfig } from '../connectionConfig'
import { create } from '@bufbuild/protobuf'
import { 
  StartRequestSchema, 
  ProcessConfigSchema,
  ProcessSelectorSchema,
  SendSignalRequestSchema,
  SendInputRequestSchema,
  ProcessInputSchema,
  UpdateRequestSchema,
  ConnectRequestSchema,
  PTYSchema,
  Signal
} from '../generated/api_pb'

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
 * PTY size configuration.
 */
export interface PtySize {
  /**
   * Number of columns.
   */
  cols: number
  /**
   * Number of rows.
   */
  rows: number
}

/**
 * Options for starting a new pseudo-terminal.
 */
export interface PtyStartOpts extends PtyRequestOpts {
  /**
   * Size of the pseudo-terminal (columns and rows).
   */
  size?: PtySize
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
  private _pid?: number
  private _data = ''
  private readonly _wait: Promise<void>
  private iterationError?: Error
  private exitCode?: number

  constructor(
    private readonly handleDisconnect: () => void,
    private readonly handleKill: (pid: number) => Promise<boolean>,
    private readonly handleSend: (pid: number, data: Uint8Array) => Promise<void>,
    private readonly events: AsyncIterable<any>,
    private readonly onData?: (data: Uint8Array) => void | Promise<void>
  ) {
    this._wait = this.handleEvents()
  }

  /**
   * Process ID of the PTY.
   */
  get pid(): number {
    if (this._pid === undefined) {
      throw new Error('PID not available yet - wait for PTY to start')
    }
    return this._pid
  }

  /**
   * Pseudo-terminal output data as string.
   */
  get data(): string {
    return this._data
  }

  /**
   * Error that occurred during PTY execution.
   */
  get error(): Error | undefined {
    return this.iterationError
  }

  /**
   * Wait for the pseudo-terminal to finish.
   */
  async wait(): Promise<void> {
    await this._wait
    if (this.iterationError) {
      throw this.iterationError
    }
  }

  /**
   * Kill the pseudo-terminal.
   *
   * @returns `true` if the pseudo-terminal was killed, `false` otherwise.
   */
  async kill(): Promise<boolean> {
    if (this._pid === undefined) {
      throw new Error('Cannot kill PTY - PID not available yet')
    }
    return await this.handleKill(this._pid)
  }

  /**
   * Send data to the pseudo-terminal.
   *
   * @param data data to send (string or Uint8Array).
   */
  async send(data: string | Uint8Array): Promise<void> {
    if (this._pid === undefined) {
      throw new Error('Cannot send data - PID not available yet')
    }
    const bytes = typeof data === 'string' 
      ? new TextEncoder().encode(data) 
      : data
    await this.handleSend(this._pid, bytes)
  }

  private async handleEvents(): Promise<void> {
    try {
      for await (const response of this.events) {
        // The event structure is: response.event.event (nested event field)
        const event = response.event?.event
        if (!event) {
          continue
        }

        const { case: eventCase, value } = event

        // Handle different event types
        if (eventCase === 'start') {
          // Extract and store PID from start event
          this._pid = value.pid
        } else if (eventCase === 'data') {
          // Handle PTY data events
          if (value.output) {
            const { case: outputCase, value: outputValue } = value.output
            
            if (outputCase === 'pty') {
              this._data += new TextDecoder().decode(outputValue)
              if (this.onData) {
                const result = this.onData(outputValue)
                if (result instanceof Promise) {
                  await result
                }
              }
            }
          }
        } else if (eventCase === 'end') {
          // Handle end event
          this.exitCode = value.exitCode
          if (value.error) {
            this.iterationError = new Error(value.error)
          }
        }
        // Ignore 'keepalive' events
      }
    } catch (error) {
      this.iterationError = error instanceof Error ? error : new Error(String(error))
    }
  }
}

/**
 * Module for interacting with the sandbox pseudo-terminals.
 */
export class Pty {
  private readonly grpcClient: GrpcClient
  private readonly connectionConfig: ConnectionConfig

  constructor(
    grpcClient: GrpcClient,
    connectionConfig: ConnectionConfig
  ) {
    this.grpcClient = grpcClient
    this.connectionConfig = connectionConfig
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
      // Default PTY size
      const size = opts?.size || { cols: 80, rows: 24 }

      // Set TERM environment variable for proper terminal emulation
      const envs = opts?.envs || {}
      envs['TERM'] = 'xterm-256color'

      // Create process config with bash interactive login shell
      const processConfig = create(ProcessConfigSchema, {
        cmd: '/bin/bash',
        args: ['-i', '-l'],
        envs,
        cwd: opts?.cwd
      })

      // Create PTY configuration
      const pty = create(PTYSchema, {
        size: {
          cols: size.cols,
          rows: size.rows
        }
      })

      // Create start request with PTY
      const startRequest = create(StartRequestSchema, {
        process: processConfig,
        pty
      })

      // Start the process and get event stream
      const events = this.grpcClient.process.start(startRequest)

      return new PtyHandle(
        () => {}, // handleDisconnect - not implemented yet
        (pid: number) => this.kill(pid), // handleKill
        (pid: number, data: Uint8Array) => this.sendInput(pid, data), // handleSend
        events,
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
    try {
      // Create process selector
      const selector = create(ProcessSelectorSchema, {
        selector: {
          case: 'pid',
          value: pid
        }
      })

      // Create connect request
      const connectRequest = create(ConnectRequestSchema, {
        process: selector
      })

      // Connect to the process and get event stream
      const events = this.grpcClient.process.connect(connectRequest)

      return new PtyHandle(
        () => {}, // handleDisconnect
        (connectedPid: number) => this.kill(connectedPid), // handleKill
        (connectedPid: number, data: Uint8Array) => this.sendInput(connectedPid, data), // handleSend
        events,
        opts?.onData
      )
    } catch (error) {
      throw new Error(`Failed to connect to pseudo-terminal: ${error}`)
    }
  }

  /**
   * Kill a running PTY by its process ID.
   *
   * @param pid process ID of the PTY.
   *
   * @returns `true` if the PTY was killed, `false` otherwise.
   */
  async kill(pid: number): Promise<boolean> {
    try {
      const selector = create(ProcessSelectorSchema, {
        selector: {
          case: 'pid',
          value: pid
        }
      })

      const request = create(SendSignalRequestSchema, {
        process: selector,
        signal: Signal.SIGKILL
      })

      await this.grpcClient.process.sendSignal(request)
      return true
    } catch (error) {
      if (String(error).includes('not found')) {
        return false
      }
      throw new Error(`Failed to kill PTY: ${error}`)
    }
  }

  /**
   * Send input to a running PTY.
   *
   * @param pid process ID of the PTY.
   * @param data data to send to the PTY.
   */
  async sendInput(pid: number, data: Uint8Array): Promise<void> {
    try {
      const selector = create(ProcessSelectorSchema, {
        selector: {
          case: 'pid',
          value: pid
        }
      })

      const input = create(ProcessInputSchema, {
        input: {
          case: 'pty',
          value: data
        }
      })

      const request = create(SendInputRequestSchema, {
        process: selector,
        input
      })

      await this.grpcClient.process.sendInput(request)
    } catch (error) {
      throw new Error(`Failed to send input to PTY: ${error}`)
    }
  }

  /**
   * Resize a running PTY.
   *
   * @param pid process ID of the PTY.
   * @param size new size of the PTY.
   */
  async resize(pid: number, size: PtySize): Promise<void> {
    try {
      const selector = create(ProcessSelectorSchema, {
        selector: {
          case: 'pid',
          value: pid
        }
      })

      const pty = create(PTYSchema, {
        size: {
          cols: size.cols,
          rows: size.rows
        }
      })

      const request = create(UpdateRequestSchema, {
        process: selector,
        pty
      })

      await this.grpcClient.process.update(request)
    } catch (error) {
      throw new Error(`Failed to resize PTY: ${error}`)
    }
  }
}
