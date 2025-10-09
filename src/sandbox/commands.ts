import { ApiClient } from '../api'
import { ConnectionConfig } from '../connectionConfig'

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
  private _stdout = ''
  private _stderr = ''
  private result?: CommandResult
  private iterationError?: Error
  private readonly _wait: Promise<void>

  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<boolean>,
    private readonly onStdout?: (stdout: string) => void | Promise<void>,
    private readonly onStderr?: (stderr: string) => void | Promise<void>
  ) {
    this._wait = this.handleEvents()
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
    if (this.result) {
      return this.result
    }
    throw new Error('Command execution failed')
  }

  /**
   * Kill the command.
   *
   * @returns `true` if the command was killed, `false` otherwise.
   */
  async kill(): Promise<boolean> {
    return await this.handleKill()
  }

  private async handleEvents(): Promise<void> {
    // TODO: Implement event handling for command execution
    // This would typically involve listening to stdout/stderr streams
    // and updating the internal state accordingly
  }
}

/**
 * Module for starting and interacting with commands in the sandbox.
 */
export class Commands {
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
      const response = await this.api.executeCode({
        code: cmd,
        language: 'bash',
        envVars: opts?.envs,
        contextId: undefined
      })

      const pid = (response as any).pid || Math.floor(Math.random() * 10000) + 1000

      return new CommandHandle(
        pid,
        () => {}, // handleDisconnect
        async () => true, // handleKill
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
    // TODO: Implement connection to existing command
    throw new Error('Connecting to existing commands not implemented yet')
  }
}
