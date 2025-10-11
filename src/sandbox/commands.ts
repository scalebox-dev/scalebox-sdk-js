import { GrpcClient } from '../grpc/client'
import { ConnectionConfig, DEFAULT_COMMAND_TIMEOUT_MS, KEEPALIVE_PING_HEADER, KEEPALIVE_PING_INTERVAL_SEC } from '../connectionConfig'
import { create } from '@bufbuild/protobuf'
import { 
  StartRequestSchema, 
  ProcessConfigSchema,
  ProcessSelectorSchema,
  SendSignalRequestSchema,
  SendInputRequestSchema,
  ProcessInputSchema,
  ListRequestSchema,
  ConnectRequestSchema,
  Signal,
  ProcessInfo
} from '../generated/api_pb'

/**
 * Options for request to the Commands API.
 */
export interface CommandRequestOpts {
  /**
   * Request timeout in milliseconds.
   */
  requestTimeoutMs?: number
}

/**
 * Options for starting a new command.
 */
export interface CommandStartOpts extends CommandRequestOpts {
  /**
   * If true, starts command in the background and the method returns immediately.
   * You can use {@link CommandHandle.wait} to wait for the command to finish.
   */
  background?: boolean
  /**
   * Working directory for the command.
   *
   * @default // home directory of the user used to start the command
   */
  cwd?: string
  /**
   * User to run the command as.
   *
   * @default `user`
   */
  user?: string
  /**
   * Environment variables used for the command.
   *
   * This overrides the default environment variables from `Sandbox` constructor.
   *
   * @default `{}`
   */
  envs?: Record<string, string>
  /**
   * Callback for command stdout output.
   */
  onStdout?: (data: string) => void | Promise<void>
  /**
   * Callback for command stderr output.
   */
  onStderr?: (data: string) => void | Promise<void>
  /**
   * Timeout for the command in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  timeoutMs?: number
}

/**
 * Options for connecting to a command.
 */
export type CommandConnectOpts = Pick<
  CommandStartOpts,
  'onStderr' | 'onStdout' | 'timeoutMs'
>

/**
 * Result of a command execution.
 */
export interface CommandResult {
  /**
   * Command execution exit code.
   * `0` if the command finished successfully.
   */
  exitCode: number
  /**
   * Command stdout output.
   */
  stdout: string
  /**
   * Command stderr output.
   */
  stderr: string
  /**
   * Error that occurred during command execution.
   */
  error?: Error
}

/**
 * Command execution handle.
 *
 * It provides methods for waiting for the command to finish, retrieving stdout/stderr, and killing the command.
 *
 * @property {number} pid process ID of the command.
 */
export class CommandHandle {
  private _pid?: number
  private _stdout = ''
  private _stderr = ''
  private result?: CommandResult
  private iterationError?: Error
  private readonly _wait: Promise<void>

  constructor(
    private readonly handleDisconnect: () => void,
    private readonly handleKill: (pid: number) => Promise<boolean>,
    private readonly events: AsyncIterable<any>,
    private readonly onStdout?: (stdout: string) => void | Promise<void>,
    private readonly onStderr?: (stderr: string) => void | Promise<void>
  ) {
    this._wait = this.handleEvents()
  }

  /**
   * Process ID of the command.
   */
  get pid(): number {
    if (this._pid === undefined) {
      throw new Error('PID not available yet - wait for command to start')
    }
    return this._pid
  }

  /**
   * Command execution exit code.
   * `0` if the command finished successfully.
   *
   * It is `undefined` if the command is still running.
   */
  get exitCode(): number | undefined {
    return this.result?.exitCode
  }

  /**
   * Command stdout output.
   */
  get stdout(): string {
    return this._stdout
  }

  /**
   * Command stderr output.
   */
  get stderr(): string {
    return this._stderr
  }

  /**
   * Error that occurred during command execution.
   */
  get error(): Error | undefined {
    return this.result?.error || this.iterationError
  }

  /**
   * Wait for the command to finish and get its result.
   *
   * @returns result of the command execution.
   */
  async wait(): Promise<CommandResult> {
    await this._wait
    
    // If there was an iteration error, throw it
    if (this.iterationError) {
      throw this.iterationError
    }
    
    // If we have a result, return it
    if (this.result) {
      return this.result
    }
    
    // Otherwise, something went wrong
    throw new Error(`Command execution failed: no result received (PID: ${this._pid})`)
  }

  /**
   * Kill the command.
   *
   * @returns `true` if the command was killed, `false` otherwise.
   */
  async kill(): Promise<boolean> {
    if (this._pid === undefined) {
      throw new Error('Cannot kill command - PID not available yet')
    }
    return await this.handleKill(this._pid)
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
          // Handle data events (stdout/stderr)
          if (value.output) {
            const { case: outputCase, value: outputValue } = value.output
            
            if (outputCase === 'stdout') {
              const stdout = new TextDecoder().decode(outputValue)
              this._stdout += stdout
              if (this.onStdout) {
                const result = this.onStdout(stdout)
                if (result instanceof Promise) {
                  await result
                }
              }
            } else if (outputCase === 'stderr') {
              const stderr = new TextDecoder().decode(outputValue)
              this._stderr += stderr
              if (this.onStderr) {
                const result = this.onStderr(stderr)
                if (result instanceof Promise) {
                  await result
                }
              }
            }
          }
        } else if (eventCase === 'end') {
          // Handle end event
          this.result = {
            exitCode: value.exitCode,
            stdout: this._stdout,
            stderr: this._stderr,
            error: value.error ? new Error(value.error) : undefined
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
 * Module for starting and interacting with commands in the sandbox.
 */
export class Commands {
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
   * Start a new command and wait until it finishes executing.
   *
   * @param cmd command to execute.
   * @param opts options for starting the command.
   *
   * @returns `CommandResult` result of the command execution.
   */
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: false }
  ): Promise<CommandResult>

  /**
   * Start a new command in the background.
   * You can use {@link CommandHandle.wait} to wait for the command to finish and get its result.
   *
   * @param cmd command to execute.
   * @param opts options for starting the command
   *
   * @returns `CommandHandle` handle to interact with the running command.
   */
  async run(
    cmd: string,
    opts: CommandStartOpts & { background: true }
  ): Promise<CommandHandle>

  /**
   * Start a new command.
   *
   * @param cmd command to execute.
   * @param opts options for starting the command.
   *   - `opts.background: true` - runs in background, returns `CommandHandle`
   *   - `opts.background: false | undefined` - waits for completion, returns `CommandResult`
   *
   * @returns Either a `CommandHandle` or a `CommandResult` (depending on `opts.background`).
   */
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: boolean }
  ): Promise<CommandHandle | CommandResult>
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: boolean }
  ): Promise<CommandHandle | CommandResult> {
    const proc = await this.start(cmd, opts)

    return opts?.background ? proc : proc.wait()
  }

  private async start(
    cmd: string,
    opts?: CommandStartOpts
  ): Promise<CommandHandle> {
    try {
      // Create process config with bash to execute the command
      const processConfig = create(ProcessConfigSchema, {
        cmd: '/bin/bash',
        args: ['-l', '-c', cmd],
        envs: opts?.envs || {},
        cwd: opts?.cwd
      })

      // Create start request
      const startRequest = create(StartRequestSchema, {
        process: processConfig
      })

      // Prepare call options with timeout and keepalive
      const callOptions: any = {}
      
      // Set timeout (default 60 seconds)
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
      if (timeoutMs > 0) {
        callOptions.timeoutMs = timeoutMs
      }

      // Set keepalive header to prevent proxy timeout
      callOptions.headers = {
        [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
      }

      // Start the process and get event stream with timeout configuration
      const events = this.grpcClient.process.start(startRequest, callOptions)

      return new CommandHandle(
        () => {}, // handleDisconnect - not implemented yet
        (pid: number) => this.kill(pid), // handleKill
        events,
        opts?.onStdout,
        opts?.onStderr
      )
    } catch (error) {
      throw new Error(`Failed to start command: ${error}`)
    }
  }

  /**
   * Connect to a running command by its process ID.
   *
   * @param pid process ID of the command.
   * @param opts options for connecting to the command.
   *
   * @returns handle to interact with the running command.
   */
  async connect(
    pid: number,
    opts?: CommandConnectOpts
  ): Promise<CommandHandle> {
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

      // Prepare call options with timeout and keepalive
      const callOptions: any = {}
      
      // Set timeout (default 60 seconds)
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
      if (timeoutMs > 0) {
        callOptions.timeoutMs = timeoutMs
      }

      // Set keepalive header to prevent proxy timeout
      callOptions.headers = {
        [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
      }

      // Connect to the process and get event stream with timeout configuration
      const events = this.grpcClient.process.connect(connectRequest, callOptions)

      return new CommandHandle(
        () => {}, // handleDisconnect
        (connectedPid: number) => this.kill(connectedPid), // handleKill
        events,
        opts?.onStdout,
        opts?.onStderr
      )
    } catch (error) {
      throw new Error(`Failed to connect to command: ${error}`)
    }
  }

  /**
   * Kill a running command by its process ID.
   *
   * @param pid process ID of the command.
   *
   * @returns `true` if the command was killed, `false` otherwise.
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
      throw new Error(`Failed to kill command: ${error}`)
    }
  }

  /**
   * List all running commands and PTY sessions.
   *
   * @returns list of running processes.
   */
  async list(): Promise<Array<{
    pid: number
    cmd: string
    args: string[]
    envs: Record<string, string>
    cwd?: string
    tag?: string
  }>> {
    try {
      const request = create(ListRequestSchema, {})
      const response = await this.grpcClient.process.list(request)

      return response.processes.map((p: ProcessInfo) => ({
        pid: p.pid,
        cmd: p.config?.cmd || '',
        args: p.config?.args || [],
        envs: p.config?.envs || {},
        cwd: p.config?.cwd,
        tag: p.tag
      }))
    } catch (error) {
      throw new Error(`Failed to list commands: ${error}`)
    }
  }

  /**
   * Send input to a running command's stdin.
   *
   * @param pid process ID of the command.
   * @param data data to send to stdin.
   */
  async sendStdin(pid: number, data: string): Promise<void> {
    try {
      const selector = create(ProcessSelectorSchema, {
        selector: {
          case: 'pid',
          value: pid
        }
      })

      const input = create(ProcessInputSchema, {
        input: {
          case: 'stdin',
          value: new TextEncoder().encode(data)
        }
      })

      const request = create(SendInputRequestSchema, {
        process: selector,
        input
      })

      await this.grpcClient.process.sendInput(request)
    } catch (error) {
      throw new Error(`Failed to send stdin: ${error}`)
    }
  }
}
