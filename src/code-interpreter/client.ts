/**
 * Code Interpreter Connect RPC Client
 * 
 * This module provides Connect RPC clients for code execution and context management.
 * It wraps the auto-generated Protocol Buffer clients with a clean TypeScript interface.
 * 
 * Key Features:
 * - ExecutionService: Stream-based code execution with real-time output
 * - ContextService: Stateful execution context management (like Jupyter kernels)
 * - Type-safe requests/responses with automatic protobuf serialization
 * - Connect protocol for maximum compatibility (HTTP/1.1, HTTP/2, proxies, etc.)
 * 
 * Architecture:
 * - Uses @connectrpc/connect for RPC communication
 * - Transforms protobuf types to ergonomic TypeScript interfaces
 * - Supports streaming responses for real-time execution feedback
 * - Handles authentication via custom headers
 */

import { Code, ConnectError, createClient, type CallOptions, type Client } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { create } from '@bufbuild/protobuf'
import type { Timestamp } from '@bufbuild/protobuf/wkt'
import {
  ContextService,
  CreateContextRequestSchema,
  DestroyContextRequestSchema,
  ExecuteRequestSchema,
  ExecutionService,
  type ExecuteResponse
} from '../generated/api_pb.js'
import type { CodeContext, ExecutionResponse, ExecutionStream } from './types'

/**
 * Convert protobuf Timestamp to JavaScript Date
 * 
 * Protobuf timestamps store time as seconds since Unix epoch plus nanoseconds.
 * This helper converts them to standard JavaScript Date objects.
 * 
 * @param timestamp - Protobuf Timestamp object
 * @returns JavaScript Date or undefined if timestamp is not provided
 */
function timestampToDate(timestamp?: Timestamp): Date | undefined {
  if (!timestamp) return undefined
  const seconds = Number(timestamp.seconds ?? 0)
  const nanos = Number(timestamp.nanos ?? 0)
  return new Date(seconds * 1000 + Math.floor(nanos / 1000000))
}

/**
 * Transform protobuf ExecuteResponse to ExecutionResponse
 * 
 * Converts the generated protobuf response type to our cleaner TypeScript interface.
 * Handles the oneof event pattern used in the protobuf definition.
 * 
 * @param response - Generated protobuf ExecuteResponse
 * @returns Transformed ExecutionResponse with clean TypeScript types
 */
function transformExecuteResponse(response: ExecuteResponse): ExecutionResponse {
  const result: ExecutionResponse = {}
  
  // Handle different event types based on the oneof pattern
  switch (response.event?.case) {
    case 'stdout':
      result.stdout = {
        content: response.event.value.content
      }
      break
    case 'stderr':
      result.stderr = {
        content: response.event.value.content
      }
      break
    case 'result':
      const res = response.event.value
      result.result = {
        exitCode: res.exitCode ?? 0,
        startedAt: timestampToDate(res.startedAt),
        finishedAt: timestampToDate(res.finishedAt),
        text: res.text,
        html: res.html,
        markdown: res.markdown,
        svg: res.svg,
        png: res.png,
        jpeg: res.jpeg,
        pdf: res.pdf,
        latex: res.latex,
        json: res.json,
        javascript: res.javascript,
        data: res.data,
        // Note: chart field needs type conversion
        // chart: res.chart, // Commented out due to type incompatibility
        executionCount: res.executionCount,
        isMainResult: res.isMainResult,
        extra: res.extra
      }
      break
    case 'error':
      result.error = {
        name: response.event.value.name,
        value: response.event.value.value,
        traceback: response.event.value.traceback
      }
      break
  }
  
  return result
}

/**
 * Execution Service Client
 * 
 * Provides streaming code execution capabilities via Connect RPC.
 * Executes code in a sandboxed environment and streams back real-time results.
 * 
 * Features:
 * - Server-streaming RPC for real-time execution feedback
 * - Supports multiple programming languages (Python, JavaScript, R, etc.)
 * - Contextual execution with persistent state
 * - Rich output formats (text, images, charts, HTML, etc.)
 * 
 * @example
 * ```typescript
 * const client = new GeneratedExecutionServiceClient('https://sandbox.example.com', {
 *   'Authorization': 'Bearer token',
 *   'X-Sandbox-ID': 'sandbox-123'
 * });
 * 
 * const stream = await client.execute({
 *   code: 'print("Hello, World!")',
 *   language: 'python'
 * });
 * 
 * for await (const response of stream) {
 *   if (response.stdout) {
 *     console.log(response.stdout.content);
 *   }
 * }
 * ```
 */
export class GeneratedExecutionServiceClient {
  private client: Client<typeof ExecutionService>
  private transport: ReturnType<typeof createConnectTransport>

  /**
   * Create a new execution service client
   * 
   * @param baseUrl - Base URL of the sandbox service (must include protocol)
   * @param headers - Custom headers for authentication and identification
   *                  Must include: Authorization: Bearer root and X-Access-Token
   */
  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    // Create transport with Connect protocol using interceptors (proper way)
    this.transport = createConnectTransport({
      baseUrl,
      useBinaryFormat: false, // Use JSON for better compatibility - Connect will auto-set Content-Type
      interceptors: [
        // Add custom headers via interceptor
        // Note: gRPC requires both Authorization: Bearer root AND X-Access-Token headers
        (next) => async (req) => {
          // Add all custom headers
          Object.entries(headers).forEach(([key, value]) => {
            req.header.set(key, value)
          })
          
          return await next(req)
        },
      ],
    })
    
    // Create client using generated service definition
    this.client = createClient(ExecutionService, this.transport)
  }
  
  /**
   * Execute code and stream results
   * 
   * Sends code to the sandbox for execution and returns a stream of results.
   * The stream will emit multiple events including stdout, stderr, results, and errors.
   * 
   * @param request - Execution request parameters
   * @param request.code - Code to execute
   * @param request.language - Programming language (default: 'python')
   * @param request.contextId - Context ID for stateful execution
   * @param request.envVars - Environment variables for the execution
   * @param options - Execution options
   * @param options.timeoutMs - Request timeout in milliseconds
   * @returns Async iterable stream of execution responses
   * 
   * @example
   * ```typescript
   * const stream = await client.execute({
   *   code: 'x = 42\nprint(x)',
   *   language: 'python',
   *   contextId: 'ctx-123'
   * });
   * 
   * for await (const response of stream) {
   *   if (response.stdout) console.log('Output:', response.stdout.content);
   *   if (response.error) console.error('Error:', response.error.value);
   * }
   * ```
   */
  async execute(
    request: {
      code: string
      language?: string
      contextId?: string
      envVars?: Record<string, string>
    },
    options?: { timeoutMs?: number }
  ): Promise<ExecutionStream> {
    // Build request using generated schema
    const executeRequest = create(ExecuteRequestSchema, {
      contextId: request.contextId || '',
      code: request.code,
      language: request.language || 'python',
      envVars: request.envVars || {}
    })
    
    const callOptions: CallOptions = {}
    if (options?.timeoutMs) {
      callOptions.signal = AbortSignal.timeout(options.timeoutMs)
    }
    
    // Call the generated execute method
    const responseStream = this.client.execute(executeRequest, callOptions)
    
    // Transform the stream to our ExecutionStream interface
    const stream: ExecutionStream = {
      async *[Symbol.asyncIterator](): AsyncIterableIterator<ExecutionResponse> {
        try {
          for await (const response of responseStream) {
            yield transformExecuteResponse(response)
          }
        } catch (error) {
          // Re-throw Connect errors as-is
          throw error
        }
      }
    }
    
    return Promise.resolve(stream)
  }
}

/**
 * Context Service Client
 * 
 * Manages stateful execution contexts for code interpreter sessions.
 * Contexts maintain state across multiple code executions, similar to Jupyter kernels.
 * 
 * Features:
 * - Create isolated execution contexts per language
 * - Persist variables, imports, and state between executions
 * - Configure working directory and environment variables
 * - Clean up contexts when done
 * 
 * @example
 * ```typescript
 * const client = new GeneratedContextServiceClient('https://sandbox.example.com', {
 *   'Authorization': 'Bearer token'
 * });
 * 
 * // Create a Python context
 * const context = await client.createContext({
 *   language: 'python',
 *   cwd: '/workspace'
 * });
 * 
 * // Use context.id in execute calls...
 * 
 * // Clean up when done
 * await client.destroyContext({ contextId: context.id });
 * ```
 */
export class GeneratedContextServiceClient {
  private client: Client<typeof ContextService>
  private transport: ReturnType<typeof createConnectTransport>

  /**
   * Create a new context service client
   * 
   * @param baseUrl - Base URL of the sandbox service (must include protocol)
   * @param headers - Custom headers for authentication and identification
   */
  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    // Create transport with Connect protocol using interceptors (proper way)
    this.transport = createConnectTransport({
      baseUrl,
      useBinaryFormat: false, // Use JSON for better compatibility - Connect will auto-set Content-Type
      interceptors: [
        // Add custom headers via interceptor
        (next) => async (req) => {
          // Add all custom headers
          Object.entries(headers).forEach(([key, value]) => {
            req.header.set(key, value)
          })
          
          return await next(req)
        },
      ],
    })
    
    // Create client using generated service definition
    this.client = createClient(ContextService, this.transport)
  }
  
  /**
   * Create a new execution context
   * 
   * Creates an isolated execution environment with persistent state.
   * Variables, imports, and other state will be maintained across
   * multiple code executions within the same context.
   * 
   * @param request - Context creation parameters
   * @param request.language - Programming language (default: 'python')
   * @param request.cwd - Working directory for code execution
   * @param options - Request options
   * @param options.timeoutMs - Request timeout in milliseconds
   * @returns Created context with unique ID
   * 
   * @example
   * ```typescript
   * const context = await client.createContext({
   *   language: 'python',
   *   cwd: '/workspace/project'
   * });
   * console.log('Context ID:', context.id);
   * ```
   */
  async createContext(
    request: {
      language?: string
      cwd?: string
    },
    options?: { timeoutMs?: number }
  ): Promise<CodeContext> {
    const createRequest = create(CreateContextRequestSchema, {
      language: request.language || 'python',
      cwd: request.cwd || ''
    })
    
    const callOptions: CallOptions = {}
    if (options?.timeoutMs) {
      callOptions.signal = AbortSignal.timeout(options.timeoutMs)
    }
    
    // Call the generated createContext method
    const response = await this.client.createContext(createRequest, callOptions)
    
    // Transform to our CodeContext interface
    const context: CodeContext = {
      id: response.id,
      language: (response.language || 'python') as any,
      cwd: response.cwd || '/tmp',
      createdAt: timestampToDate(response.createdAt) || new Date(),
      envVars: response.envVars || {},
      metadata: {}
    }
    
    return context
  }
  
  /**
   * Destroy an execution context
   * 
   * Cleans up and removes an execution context, freeing associated resources.
   * All state within the context will be lost.
   * 
   * @param request - Context destruction parameters
   * @param request.contextId - ID of the context to destroy
   * @param options - Request options
   * @param options.timeoutMs - Request timeout in milliseconds
   * @returns True if context was successfully destroyed
   * 
   * @example
   * ```typescript
   * const success = await client.destroyContext({
   *   contextId: 'ctx-abc123'
   * });
   * if (success) {
   *   console.log('Context destroyed successfully');
   * }
   * ```
   */
  async destroyContext(
    request: {
      contextId: string
    },
    options?: { timeoutMs?: number }
  ): Promise<boolean> {
    const destroyRequest = create(DestroyContextRequestSchema, {
      contextId: request.contextId
    })
    
    const callOptions: CallOptions = {}
    if (options?.timeoutMs) {
      callOptions.signal = AbortSignal.timeout(options.timeoutMs)
    }
    
    // Call the generated destroyContext method
    const response = await this.client.destroyContext(destroyRequest, callOptions)
    
    return response.success
  }
}

/**
 * Create an ExecutionService client
 * 
 * Factory function for creating a properly configured execution service client.
 * Validates the base URL and returns a ready-to-use client instance.
 * 
 * @param baseUrl - Base URL of the sandbox service (must include http:// or https://)
 * @param headers - Custom headers for authentication (default: {})
 * @returns Configured execution service client
 * @throws {Error} If baseUrl is missing or invalid
 * 
 * @example
 * ```typescript
 * const client = createExecutionServiceClient(
 *   'https://my-sandbox.example.com',
 *   { 'Authorization': 'Bearer token123' }
 * );
 * ```
 */
export function createExecutionServiceClient(
  baseUrl: string,
  headers: Record<string, string> = {}
): GeneratedExecutionServiceClient {
  if (!baseUrl) {
    throw new Error('baseUrl is required for Connect client')
  }
  
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error('baseUrl must include protocol (http:// or https://)')
  }
  
  return new GeneratedExecutionServiceClient(baseUrl, headers)
}

/**
 * Create a ContextService client
 * 
 * Factory function for creating a properly configured context service client.
 * Validates the base URL and returns a ready-to-use client instance.
 * 
 * @param baseUrl - Base URL of the sandbox service (must include http:// or https://)
 * @param headers - Custom headers for authentication (default: {})
 * @returns Configured context service client
 * @throws {Error} If baseUrl is missing or invalid
 * 
 * @example
 * ```typescript
 * const client = createContextServiceClient(
 *   'https://my-sandbox.example.com',
 *   { 'Authorization': 'Bearer token123' }
 * );
 * ```
 */
export function createContextServiceClient(
  baseUrl: string,
  headers: Record<string, string> = {}
): GeneratedContextServiceClient {
  if (!baseUrl) {
    throw new Error('baseUrl is required for Connect client')
  }
  
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error('baseUrl must include protocol (http:// or https://)')
  }
  
  return new GeneratedContextServiceClient(baseUrl, headers)
}

/**
 * Re-export Connect error types for error handling
 * 
 * - Code: gRPC status codes
 * - ConnectError: Connect-specific error type with additional metadata
 */
export { Code, ConnectError } from '@connectrpc/connect'

/**
 * Handle and normalize Connect errors
 * 
 * Converts any error type to a standard Error instance while preserving
 * Connect error information. This ensures consistent error handling across
 * the codebase.
 * 
 * @param err - Error of any type
 * @returns Normalized Error instance
 * 
 * @example
 * ```typescript
 * try {
 *   await client.execute({ code: 'print("hi")' });
 * } catch (err) {
 *   const error = handleConnectError(err);
 *   console.error('Execution failed:', error.message);
 * }
 * ```
 */
export function handleConnectError(err: unknown): Error {
  if (err instanceof Error) {
    return err
  }
  return new Error(String(err))
}