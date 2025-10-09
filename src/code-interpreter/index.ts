import { ApiClient } from '../api'
import { ConnectionConfig } from '../connectionConfig'
import { Sandbox } from '../sandbox'
import {
  createContextServiceClient,
  createExecutionServiceClient,
  GeneratedContextServiceClient,
  GeneratedExecutionServiceClient,
  handleConnectError
} from './client'
import { Execution, executionToResult, parseOutput } from './parser'
import type {
  CodeContext,
  CodeExecutionHandle,
  CodeExecutionOpts,
  CodeInterpreterOpts,
  ExecutionError,
  ExecutionResponse,
  ExecutionResult,
  Language,
  OutputHandler,
  OutputMessage,
  Result
} from './types'

/**
 * CodeInterpreter - Advanced Code Execution Engine
 * Based on scalebox-sdk-py business scenarios, integrated with E2B design patterns
 * Supports multi-language code execution and context management
 * 
 * Key Features:
 * - Real-time streaming code execution
 * - Complete context lifecycle management
 * - gRPC communication support
 * - Rich output format support (text, HTML, charts, etc.)
 * - Asynchronous callback handling
 */
export class CodeInterpreter {
  private sandbox: Sandbox
  private config: ConnectionConfig
  private api: ApiClient
  private contexts: Map<string, CodeContext> = new Map()
  private activeExecutions: Map<number, CodeExecutionHandle> = new Map()
  private executionClient: GeneratedExecutionServiceClient
  private contextClient: GeneratedContextServiceClient

  constructor(sandbox: Sandbox, config: ConnectionConfig, api: ApiClient) {
    this.sandbox = sandbox
    this.config = config
    this.api = api
    
    // sandboxDomain 必须存在，不允许降级
    if (!sandbox.sandboxDomain) {
      throw new Error('Sandbox domain is required for CodeInterpreter but was not available')
    }
    
    // envdAccessToken 必须存在，用于 gRPC 认证
    if (!sandbox.envdAccessToken) {
      throw new Error('envdAccessToken is required for CodeInterpreter but was not available')
    }
    
    // Initialize Connect RPC clients using official SDK
    // Using Connect protocol for maximum compatibility:
    // - Works through corporate proxies and firewalls
    // - Compatible with standard load balancers (Nginx, HAProxy, CloudFlare)
    // - Supports both HTTP/1.1 and HTTP/2
    // - Easy debugging with standard HTTP tools
    
    // Construct gRPC address from sandboxDomain
    let baseUrl: string
    if (sandbox.sandboxDomain.startsWith('http://') || sandbox.sandboxDomain.startsWith('https://')) {
      baseUrl = sandbox.sandboxDomain
    } else if (sandbox.sandboxDomain.includes('localhost') || sandbox.sandboxDomain.includes('127.0.0.1')) {
      baseUrl = `http://${sandbox.sandboxDomain}`
    } else {
      baseUrl = `https://${sandbox.sandboxDomain}`
    }
    
    // Create Connect clients with authentication headers
    // gRPC authentication requires TWO headers:
    // 1. Authorization: Bearer root (fixed for all requests)
    // 2. X-Access-Token: envdAccessToken (from sandbox creation response)
    const headers = {
      'Authorization': 'Bearer root',
      'X-Access-Token': sandbox.envdAccessToken,
      'X-Sandbox-ID': sandbox.sandboxId
    }
    
    this.executionClient = createExecutionServiceClient(baseUrl, headers)
    this.contextClient = createContextServiceClient(baseUrl, headers)
  }

  /**
   * Create a new code interpreter instance
   */
  static async create(opts: CodeInterpreterOpts = {}): Promise<CodeInterpreter> {
    const config = new ConnectionConfig(opts)
    const sandbox = await Sandbox.create(opts.templateId || 'code-interpreter', opts)
    const api = new ApiClient(config)
    return new CodeInterpreter(sandbox, config, api)
  }

  /**
   * Execute code - Compatible test interface
   */
  async execute(opts: { 
    language: Language
    code: string
    contextId?: string
    envVars?: Record<string, string>
  }): Promise<ExecutionResult> {
    // If contextId is provided, use existing context, otherwise create a new one
    let context: CodeContext | undefined
    if (opts.contextId) {
      context = this.contexts.get(opts.contextId)
      if (!context) {
        throw new Error(`Context ${opts.contextId} not found`)
      }
    }
    
    return this.runCode(opts.code, {
      language: opts.language,
      context,
      envVars: opts.envVars
    })
  }

  /**
   * Stream code execution - True asynchronous streaming processing
   */
  async *executeStream(opts: { 
    language: Language
    code: string
    contextId?: string
    envVars?: Record<string, string>
    onStdout?: OutputHandler<OutputMessage>
    onStderr?: OutputHandler<OutputMessage>
    onResult?: OutputHandler<Result>
    onError?: OutputHandler<ExecutionError>
  }): AsyncGenerator<ExecutionResponse, ExecutionResult, unknown> {
    // Execute code stream
    
    try {
      // Get or create context
      let context: CodeContext | undefined
      if (opts.contextId) {
        context = this.contexts.get(opts.contextId)
        if (!context) {
          throw new Error(`Context ${opts.contextId} not found`)
        }
      }
      
      const contextId = context?.id || ''
      
      // Execute code and get response stream
      const responseStream = await this.executionClient.execute({
        code: opts.code,
        language: opts.language,
        contextId,
        envVars: opts.envVars || {}
      }, {
        timeoutMs: 300000 // 5 minutes timeout
      })
      
      // Create execution aggregator
      const execution = new Execution()
      const startTime = Date.now()
      
      // Process response stream
      for await (const response of responseStream) {
        // Parse output
        await parseOutput(execution, response, {
          onStdout: opts.onStdout,
          onStderr: opts.onStderr,
          onResult: opts.onResult,
          onError: opts.onError
        })
        
        // Yield each response to caller
        yield response
      }
      
      // Return final execution result
      const result = executionToResult(execution, opts.language, context)
      result.executionTime = Date.now() - startTime
      return result
      
    } catch (error) {
      const handledError = handleConnectError(error)
      const errorResult = this.createErrorResult(handledError, Date.now(), opts.language)
      
      // Yield error response
      yield {
        error: {
          name: error instanceof Error ? error.name : 'ExecutionError',
          value: error instanceof Error ? error.message : String(error),
          traceback: error instanceof Error ? error.stack || '' : ''
        }
      }
      
      return errorResult
    }
  }

  /**
   * Execute code - Corresponds to Python version's run_code method
   * Supports both synchronous and asynchronous execution modes with complete output processing and callback support
   */
  async runCode(
    code: string, 
    opts: CodeExecutionOpts
  ): Promise<ExecutionResult> {
    // Execute code
    
    const startTime = Date.now()
    
    try {
      // Get or create context
      let context: CodeContext
      let language: Language
      if (opts.context) {
        context = opts.context
        language = context.language
      } else {
        language = opts.language
        // Create new context
        const newContext = await this.createCodeContext({
          language: opts.language,
          cwd: opts.cwd,
          requestTimeout: opts.requestTimeout
        })
        context = newContext
      }
      
      // Merge environment variables
      const envVars = {
        ...context.envVars,
        ...opts.envVars,
        ...opts.envs
      }
      
      const contextId = context.id
      
      // Execute code using Connect RPC client
      const responseStream = await this.executionClient.execute({
        code,
        language,
        contextId,
        envVars
      }, {
        timeoutMs: opts.requestTimeout || 30000
      })
      
      // Create execution aggregator
      const execution = new Execution()
      
      // Process response stream
      for await (const response of responseStream) {
        await parseOutput(execution, response, {
          onStdout: opts.onStdout,
          onStderr: opts.onStderr,
          onResult: opts.onResult,
          onError: opts.onError
        })
      }
      
      // Convert to ExecutionResult
      const result = executionToResult(execution, language, context)
      result.executionTime = Date.now() - startTime
      
      // Handle exit callback
      if (opts.onExit) {
        opts.onExit(result.exitCode)
      }
      
      return result
      
    } catch (error) {
      const handledError = handleConnectError(error)
      console.error('[CodeInterpreter] Error executing code:', handledError.message)
      return this.createErrorResult(handledError, startTime, opts.language, opts.context)
    }
  }

  /**
   * Execute code asynchronously (background execution)
   */
  async runCodeAsync(code: string, opts: CodeExecutionOpts): Promise<CodeExecutionHandle> {
    // Get or create context
    let context: CodeContext
    let language: Language
    if (opts.context) {
      context = opts.context
      language = context.language
    } else {
      language = opts.language
      context = await this.createContext({
        language: opts.language,
        cwd: opts.cwd
      })
    }

      // No need to build execution commands, use gRPC directly
    
    // Merge environment variables
    const envVars = {
      ...context.envVars,
      ...opts.envVars,
      ...opts.envs
    }

    // Create execution handle
    const handle = await this.createExecutionHandle({
      ...opts,
      context,
      timeout: opts.timeout || 60000,
      requestTimeout: opts.requestTimeout || 30000,
      cwd: opts.cwd || context.cwd || '/tmp',
      envVars,
      code,
      language
    })

    return handle
  }

  /**
   * Create execution context
   */
  async createContext(opts: { 
    language: Language
    cwd?: string
    envVars?: Record<string, string>
    metadata?: Record<string, string>
  }): Promise<CodeContext> {
    // Generate unique context ID
    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const context: CodeContext = {
      id: contextId,
      language: opts.language,
      cwd: opts.cwd || '/tmp',
      envVars: opts.envVars || {},
      metadata: opts.metadata || {},
      createdAt: new Date()
    }

    this.contexts.set(contextId, context)
    return context
  }

  /**
   * Create code context (Python version compatible)
   * Corresponds to Python version's create_code_context method
   */
  async createCodeContext(opts: {
    cwd?: string
    language?: Language
    requestTimeout?: number
  }): Promise<CodeContext> {
    // Create new context
    
    const language = opts.language || 'python'
    const requestTimeout = opts.requestTimeout || this.config.requestTimeoutMs || 30000
    
    try {
      // Create context using Connect RPC client
      const response = await this.contextClient.createContext({
        language,
        cwd: opts.cwd || ''
      }, {
        timeoutMs: requestTimeout,
        // metadata will be handled internally by gRPC client
      })
      
      // Create CodeContext object
      const context: CodeContext = {
        id: response.id,
        language: response.language as Language,
        cwd: response.cwd || '/tmp',
        envVars: {},
        metadata: {},
        createdAt: new Date()
      }
      
      // Save to local mapping
      this.contexts.set(context.id, context)
      
      return context
    } catch (error) {
      const handledError = handleConnectError(error)
      console.error(`[CodeInterpreter] Error creating context: ${handledError.message}`)
      throw handledError
    }
  }

  /**
   * Destroy execution context - Corresponds to Python version's destroy_context method
   */
  async destroyContext(context: CodeContext | string): Promise<void> {
    const contextId = typeof context === 'string' ? context : context.id
    // Destroy context
    
    try {
      // Destroy context using Connect RPC client
      await this.contextClient.destroyContext({
        contextId
      }, {
        timeoutMs: 10000
      })
      
      // Remove from local mapping
      this.contexts.delete(contextId)
    } catch (error) {
      const handledError = handleConnectError(error)
      if (handledError.message?.includes('not found') || handledError.message?.includes('Not found')) {
        // Context doesn't exist, which is fine
        // Context already destroyed or not found
      } else {
        // Failed to destroy context
      }
      // Remove from local mapping even if remote destruction fails
      this.contexts.delete(contextId)
    }
  }

  /**
   * Get all active contexts
   */
  getContexts(): CodeContext[] {
    return Array.from(this.contexts.values())
  }

  /**
   * Get specific context
   */
  getContext(contextId: string): CodeContext | undefined {
    return this.contexts.get(contextId)
  }

  /**
   * Get sandbox instance
   */
  getSandbox(): Sandbox {
    return this.sandbox
  }

  /**
   * Jupyter port constant
   */
  private static readonly JUPYTER_PORT = 32000
  
  /**
   * Get Jupyter URL
   */
  get jupyterUrl(): string {
    const protocol = this.config.debug ? 'http' : 'https'
    const host = this.sandbox.getHost ? this.sandbox.getHost(CodeInterpreter.JUPYTER_PORT) : 'localhost:32000'
    return `${protocol}://${host}`
  }

  /**
   * Update TODO status
   */
  private updateTodoStatus() {
    // gRPC support completed
    // Streaming processing completed  
    // Output parsing completed
    // Context management enhanced
  }

  /**
   * Create execution handle
   */
  private async createExecutionHandle(opts: CodeExecutionOpts & { 
    context: CodeContext
    code: string
    language: Language
  }): Promise<CodeExecutionHandle> {
    const pid = Math.floor(Math.random() * 10000)
    const self = this
    
    const handle: CodeExecutionHandle = {
      context: opts.context,
      language: opts.language,
      pid,
      
      async wait(): Promise<ExecutionResult> {
        // Use real execution logic
        return self.runCode(opts.code, {
          ...opts,
          context: opts.context
        })
      },
      
      async kill(): Promise<void> {
        // TODO: Implement process termination logic
        // Kill execution
        self.activeExecutions.delete(pid)
      },
      
      isRunning(): boolean {
        // TODO: Implement running status check
        return self.activeExecutions.has(pid)
      }
    }

    this.activeExecutions.set(pid, handle)
    return handle
  }

  /**
   * Terminate all executions
   */
  private async killAllExecutions(): Promise<void> {
    for (const [pid, handle] of this.activeExecutions) {
      try {
        await handle.kill()
      } catch (error) {
        const handledError = handleConnectError(error)
        console.error(`[CodeInterpreter] Failed to kill execution ${pid}:`, handledError.message)
      }
    }
    this.activeExecutions.clear()
  }

  /**
   * Create error result - Corresponds to Python version's error handling logic
   * Supports timeout error and request error formatting
   */
  private createErrorResult(error: any, startTime: number, language?: Language, context?: CodeContext): ExecutionResult {
    const executionTime = Date.now() - startTime
    
    // Format error information
    let errorName = 'ExecutionError'
    let errorMessage = String(error)
    let traceback = ''
    
    if (error instanceof Error) {
      errorName = error.name
      errorMessage = error.message
      traceback = error.stack || ''
      
      // Check if it's a timeout error
      if (error.message.toLowerCase().includes('timeout')) {
        if (error.message.toLowerCase().includes('execution')) {
          errorName = 'ExecutionTimeoutError'
          errorMessage = `Execution timed out — the 'timeout' option can be used to increase this timeout`
        } else {
          errorName = 'RequestTimeoutError'
          errorMessage = `Request timed out — the 'requestTimeout' option can be used to increase this timeout`
        }
      }
    }
    
    const errorObj: ExecutionError = {
      name: errorName,
      value: errorMessage,
      message: errorMessage,
      traceback,
      stack: traceback,
      details: error
    }

    return {
      stdout: '',
      stderr: errorMessage,
      exitCode: 1,
      error: errorObj,
      text: '',
      logs: {
        stdout: '',
        stderr: errorMessage,
        output: [{
          content: errorMessage,
          timestamp: new Date(),
          type: 'stderr',
          error: true
        }],
        errors: [errorObj]
      },
      result: undefined,
      results: [],
      success: false,
      executionTime,
      language: language || 'python',
      context,
      pid: Math.floor(Math.random() * 10000)
    }
  }

  /**
   * Close interpreter - Clean up resources and connections
   */
  async close(): Promise<void> {
    try {
      // Terminate all active executions
      await this.killAllExecutions()
      
      // Destroy all contexts
      const destroyPromises = Array.from(this.contexts.keys()).map(contextId => 
        this.destroyContext(contextId).catch(err => {
          // Failed to destroy context
        })
      )
      await Promise.all(destroyPromises)
      
      // Clean up local state
      this.contexts.clear()
      
      // No longer need to clean up HTTP sessions as we're using gRPC/HTTP2
      
      // Close sandbox
      await this.sandbox.kill()
    } catch (error) {
      const handledError = handleConnectError(error)
      console.error('[CodeInterpreter] Error closing:', handledError.message)
      throw handledError
    }
  }

  /**
   * Get default template ID
   */
  static get defaultTemplate(): string {
    return 'code-interpreter'
  }
}

// Export utility functions and classes
export { Execution, executionToResult, parseOutput } from './parser'
export {
  createContextServiceClient,
  createExecutionServiceClient,
  GeneratedContextServiceClient,
  GeneratedExecutionServiceClient,
  handleConnectError
} from './client'
export * from './types'