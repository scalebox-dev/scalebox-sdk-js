import { ConnectionConfig } from '../connectionConfig'
import { GrpcClient } from '../grpc/client'
import { create } from '@bufbuild/protobuf'
import { ProcessSelectorSchema, ProcessInputSchema } from '../generated/api_pb.js'

// Type declarations for Node.js modules
declare const require: (id: string) => any

/**
 * Process configuration for starting new processes
 */
export interface ProcessConfig {
  /**
   * Command to execute
   */
  cmd: string
  /**
   * Command arguments
   */
  args?: string[]
  /**
   * Environment variables
   */
  envs?: Record<string, string>
  /**
   * Working directory
   */
  cwd?: string
}

/**
 * PTY (Pseudo-Terminal) configuration
 */
export interface PTYConfig {
  /**
   * Terminal size
   */
  size?: {
    cols: number
    rows: number
  }
}

/**
 * Process information
 */
export interface ProcessInfo {
  /**
   * Process configuration
   */
  config: ProcessConfig
  /**
   * Process ID
   */
  pid: number
  /**
   * Process tag (optional identifier)
   */
  tag?: string
}

/**
 * Process selector for operations
 */
export interface ProcessSelector {
  /**
   * Select by process ID
   */
  pid?: number
  /**
   * Select by process tag
   */
  tag?: string
}

/**
 * Process event types
 */
export interface ProcessEvent {
  type: 'start' | 'data' | 'end' | 'keepalive'
  data?: {
    pid?: number
    stdout?: Uint8Array
    stderr?: Uint8Array
    pty?: Uint8Array
    exitCode?: number
    exited?: boolean
    status?: string
    error?: string
  }
}

/**
 * Process request options
 */
export interface ProcessRequestOpts {
  /**
   * User to perform the operation as
   */
  user?: string
  /**
   * Request timeout in milliseconds
   */
  requestTimeoutMs?: number
}

/**
 * Process start options
 */
export interface ProcessStartOpts extends ProcessRequestOpts {
  /**
   * PTY configuration
   */
  pty?: PTYConfig
  /**
   * Process tag for identification
   */
  tag?: string
}

/**
 * Process connect options
 */
export interface ProcessConnectOpts extends ProcessRequestOpts {}

/**
 * Signal types
 */
export type ProcessSignal = 'SIGTERM' | 'SIGKILL'

/**
 * Module for managing sandbox processes.
 * Provides process lifecycle management, I/O streaming, and signal handling.
 */
export class ProcessManager {
  private readonly connectionConfig: ConnectionConfig
  private readonly sandboxId: string
  private readonly sandboxDomain: string
  private readonly grpcClient: GrpcClient
  private readonly processGrpc: any

  constructor(
    sandboxId: string,
    connectionConfig: ConnectionConfig,
    sandboxDomain: string,
    envdAccessToken?: string,
    grpcClient?: GrpcClient
  ) {
    this.sandboxId = sandboxId
    this.sandboxDomain = sandboxDomain
    this.connectionConfig = connectionConfig
    
    // Pass sandboxDomain and envdAccessToken to GrpcClient
    // sandboxDomain will be used as the gRPC endpoint for all gRPC operations
    this.grpcClient = grpcClient || new GrpcClient(connectionConfig, sandboxDomain, envdAccessToken)
    this.processGrpc = this.grpcClient.process
  }

  /**
   * List all running processes in the sandbox.
   *
   * @param opts request options
   * @returns list of running processes
   */
  async list(opts?: ProcessRequestOpts): Promise<ProcessInfo[]> {
    try {
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

      if (this.connectionConfig.debug) {
        console.log('📋 Listing processes via gRPC')
      }

      const response = await this.processGrpc.list({}, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      const processes = response.processes.map((proc: any) => ({
        config: {
          cmd: proc.config.cmd,
          args: proc.config.args || [],
          envs: proc.config.envs || {},
          cwd: proc.config.cwd
        },
        pid: proc.pid,
        tag: proc.tag
      }))

      if (this.connectionConfig.debug) {
        console.log(`📋 Found ${processes.length} running processes`)
      }

      return processes
    } catch (error) {
      this.handleGrpcError(error, 'list processes')
    }
  }

  /**
   * Start a new process in the sandbox.
   * Returns a stream of process events (start, stdout/stderr, end).
   *
   * @param config process configuration
   * @param opts start options
   * @returns async generator of process events
   */
  async *start(
    config: ProcessConfig,
    opts?: ProcessStartOpts
  ): AsyncGenerator<ProcessEvent, void, unknown> {
    const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

    if (this.connectionConfig.debug) {
      console.log('🚀 Starting process via gRPC stream:', config)
    }

    try {
      const request = {
        process: {
          cmd: config.cmd,
          args: config.args || [],
          envs: config.envs || {},
          cwd: config.cwd
        },
        pty: opts?.pty ? {
          size: {
            cols: opts.pty.size?.cols || 80,
            rows: opts.pty.size?.rows || 24
          }
        } : undefined,
        tag: opts?.tag
      }

      // Use gRPC streaming for real-time process events
      const stream = this.processGrpc.start(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      for await (const response of stream) {
        const event = response.event
        
        // Handle protobuf oneof structure with case/value
        if (event?.event) {
          const { case: eventCase, value } = event.event
          
          if (eventCase === 'start') {
            yield {
              type: 'start',
              data: { pid: value.pid }
            }
          } else if (eventCase === 'data') {
            const outputData: any = {}
            
            // Check for output field which contains stdout/stderr/pty
            if (value.output) {
              const { case: outputCase, value: outputValue } = value.output
              if (outputCase === 'stdout') {
                outputData.stdout = outputValue
              } else if (outputCase === 'stderr') {
                outputData.stderr = outputValue
              } else if (outputCase === 'pty') {
                outputData.pty = outputValue
              }
            }
            
            if (Object.keys(outputData).length > 0) {
              yield {
                type: 'data',
                data: outputData
              }
            }
          } else if (eventCase === 'end') {
            yield {
              type: 'end',
              data: {
                exitCode: value.exitCode,
                exited: value.exited,
                status: value.status,
                error: value.error
              }
            }
          } else if (eventCase === 'keepalive') {
            yield {
              type: 'keepalive'
            }
          }
        }
      }
    } catch (error) {
      if (this.connectionConfig.debug) {
        console.error('🚀 Process start error:', error)
      }
      this.handleGrpcError(error, `start process ${config.cmd}`)
    }
  }

  /**
   * Connect to an existing process.
   * Returns a stream of process events from the existing process.
   *
   * @param selector process selector (pid or tag)
   * @param opts connect options
   * @returns async generator of process events
   */
  async *connect(
    selector: ProcessSelector,
    opts?: ProcessConnectOpts
  ): AsyncGenerator<ProcessEvent, void, unknown> {
    const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

    if (this.connectionConfig.debug) {
      console.log('🔌 Connecting to process via gRPC stream:', selector)
    }

    try {
      const processSelector = create(ProcessSelectorSchema, 
        selector.pid !== undefined ? 
          { selector: { case: "pid", value: selector.pid } } :
          { selector: { case: "tag", value: selector.tag! } }
      )

      const request = {
        process: processSelector
      }

      const stream = this.processGrpc.connect(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      for await (const response of stream) {
        const event = response.event
        
        // Handle protobuf oneof structure with case/value
        if (event?.event) {
          const { case: eventCase, value } = event.event
          
          if (eventCase === 'start') {
            yield {
              type: 'start',
              data: { pid: value.pid }
            }
          } else if (eventCase === 'data') {
            const outputData: any = {}
            
            // Check for output field which contains stdout/stderr/pty
            if (value.output) {
              const { case: outputCase, value: outputValue } = value.output
              if (outputCase === 'stdout') {
                outputData.stdout = outputValue
              } else if (outputCase === 'stderr') {
                outputData.stderr = outputValue
              } else if (outputCase === 'pty') {
                outputData.pty = outputValue
              }
            }
            
            if (Object.keys(outputData).length > 0) {
              yield {
                type: 'data',
                data: outputData
              }
            }
          } else if (eventCase === 'end') {
            yield {
              type: 'end',
              data: {
                exitCode: value.exitCode,
                exited: value.exited,
                status: value.status,
                error: value.error
              }
            }
          } else if (eventCase === 'keepalive') {
            yield {
              type: 'keepalive'
            }
          }
        }
      }
    } catch (error) {
      if (this.connectionConfig.debug) {
        console.error('🔌 Process connect error:', error)
      }
      this.handleGrpcError(error, `connect to process ${JSON.stringify(selector)}`)
    }
  }

  /**
   * Send input to a process.
   *
   * @param selector process selector (pid or tag)
   * @param input input data (string or bytes)
   * @param opts request options
   */
  async sendInput(
    selector: ProcessSelector,
    input: string | Uint8Array,
    opts?: ProcessRequestOpts
  ): Promise<void> {
    try {
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

      if (this.connectionConfig.debug) {
        console.log('⌨️ Sending input to process via gRPC:', selector)
      }

      const inputData = typeof input === 'string' ? 
        new TextEncoder().encode(input) : input

      // Validate selector
      if (selector.pid === undefined && !selector.tag) {
        throw new Error('ProcessSelector must have either pid or tag')
      }

      const processSelector = create(ProcessSelectorSchema, 
        selector.pid !== undefined ? 
          { selector: { case: "pid", value: selector.pid } } :
          { selector: { case: "tag", value: selector.tag! } }
      )

      const processInput = create(ProcessInputSchema, {
        input: { case: "stdin", value: inputData }
      })

      const request = {
        process: processSelector,
        input: processInput
      }

      await this.processGrpc.sendInput(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      if (this.connectionConfig.debug) {
        console.log('⌨️ Input sent to process')
      }
    } catch (error) {
      this.handleGrpcError(error, `send input to process ${JSON.stringify(selector)}`)
    }
  }

  /**
   * Send PTY input to a process.
   *
   * @param selector process selector (pid or tag)
   * @param input PTY input data
   * @param opts request options
   */
  async sendPtyInput(
    selector: ProcessSelector,
    input: string | Uint8Array,
    opts?: ProcessRequestOpts
  ): Promise<void> {
    try {
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

      if (this.connectionConfig.debug) {
        console.log('⌨️ Sending PTY input to process via gRPC:', selector)
      }

      const inputData = typeof input === 'string' ? 
        new TextEncoder().encode(input) : input

      const processSelector = create(ProcessSelectorSchema, 
        selector.pid !== undefined ? 
          { selector: { case: "pid", value: selector.pid } } :
          { selector: { case: "tag", value: selector.tag! } }
      )

      const processInput = create(ProcessInputSchema, {
        input: { case: "pty", value: inputData }
      })

      const request = {
        process: processSelector,
        input: processInput
      }

      await this.processGrpc.sendInput(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      if (this.connectionConfig.debug) {
        console.log('⌨️ PTY input sent to process')
      }
    } catch (error) {
      this.handleGrpcError(error, `send PTY input to process ${JSON.stringify(selector)}`)
    }
  }

  /**
   * Send a signal to a process.
   *
   * @param selector process selector (pid or tag)
   * @param signal signal to send
   * @param opts request options
   */
  async sendSignal(
    selector: ProcessSelector,
    signal: ProcessSignal,
    opts?: ProcessRequestOpts
  ): Promise<void> {
    try {
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

      if (this.connectionConfig.debug) {
        console.log('📡 Sending signal to process via gRPC:', { selector, signal })
      }

      const grpcSignal = signal === 'SIGTERM' ? 15 : 9 // SIGKILL

      const processSelector = create(ProcessSelectorSchema, 
        selector.pid !== undefined ? 
          { selector: { case: "pid", value: selector.pid } } :
          { selector: { case: "tag", value: selector.tag! } }
      )

      const request = {
        process: processSelector,
        signal: grpcSignal
      }

      await this.processGrpc.sendSignal(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      if (this.connectionConfig.debug) {
        console.log('📡 Signal sent to process')
      }
    } catch (error) {
      this.handleGrpcError(error, `send signal ${signal} to process ${JSON.stringify(selector)}`)
    }
  }

  /**
   * Update process configuration (PTY size, etc.).
   *
   * @param selector process selector (pid or tag)
   * @param config update configuration
   * @param opts request options
   */
  async update(
    selector: ProcessSelector,
    config: { pty?: PTYConfig },
    opts?: ProcessRequestOpts
  ): Promise<void> {
    if (config.pty) {
      return this.updatePty(selector, config.pty, opts)
    }
  }

  /**
   * Update process PTY size.
   *
   * @param selector process selector (pid or tag)
   * @param pty PTY configuration
   * @param opts request options
   */
  async updatePty(
    selector: ProcessSelector,
    pty: PTYConfig,
    opts?: ProcessRequestOpts
  ): Promise<void> {
    try {
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

      if (this.connectionConfig.debug) {
        console.log('📏 Updating process PTY via gRPC:', { selector, pty })
      }

      const processSelector = create(ProcessSelectorSchema, 
        selector.pid !== undefined ? 
          { selector: { case: "pid", value: selector.pid } } :
          { selector: { case: "tag", value: selector.tag! } }
      )

      const request = {
        process: processSelector,
        pty: {
          size: {
            cols: pty.size?.cols || 80,
            rows: pty.size?.rows || 24
          }
        }
      }

      await this.processGrpc.update(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      if (this.connectionConfig.debug) {
        console.log('📏 Process PTY updated')
      }
    } catch (error) {
      this.handleGrpcError(error, `update PTY for process ${JSON.stringify(selector)}`)
    }
  }

  /**
   * Handle gRPC errors consistently
   */
  private handleGrpcError(error: any, operation: string): never {
    let errorMessage = error.message || 'Unknown gRPC error'
    
    if (error.code) {
      errorMessage = `gRPC ${error.code}: ${errorMessage}`
    }
    
    throw new Error(`Failed to ${operation}: ${errorMessage}`)
  }
}
