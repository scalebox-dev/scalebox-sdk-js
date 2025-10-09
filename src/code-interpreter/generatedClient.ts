/**
 * Code Interpreter client using generated Connect RPC code
 * 
 * This implementation uses the auto-generated Connect RPC clients
 * from the Protocol Buffer definitions, following best practices.
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
 */
function timestampToDate(timestamp?: Timestamp): Date | undefined {
  if (!timestamp) return undefined
  // Timestamp has seconds and nanos fields
  const seconds = Number(timestamp.seconds ?? 0)
  const nanos = Number(timestamp.nanos ?? 0)
  return new Date(seconds * 1000 + Math.floor(nanos / 1000000))
}

/**
 * Transform generated ExecuteResponse to our ExecutionResponse format
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
 * ExecutionService client using generated Connect RPC code
 */
export class GeneratedExecutionServiceClient {
  private client: Client<typeof ExecutionService>
  private transport: ReturnType<typeof createConnectTransport>

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    // Create transport with Connect protocol
    this.transport = createConnectTransport({
      baseUrl,
      useBinaryFormat: false, // Use JSON for better compatibility
      interceptors: [],
      fetch: (input, init) => {
        // Add custom headers
        return fetch(input, {
          ...init,
          headers: {
            ...headers,
            ...(init?.headers as Record<string, string>)
          }
        })
      }
    })
    
    // Create client using generated service definition
    this.client = createClient(ExecutionService, this.transport)
  }
  
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
 * ContextService client using generated Connect RPC code
 */
export class GeneratedContextServiceClient {
  private client: Client<typeof ContextService>
  private transport: ReturnType<typeof createConnectTransport>

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    // Create transport with Connect protocol
    this.transport = createConnectTransport({
      baseUrl,
      useBinaryFormat: false, // Use JSON for better compatibility
      interceptors: [],
      fetch: (input, init) => {
        // Add custom headers
        return fetch(input, {
          ...init,
          headers: {
            ...headers,
            ...(init?.headers as Record<string, string>)
          }
        })
      }
    })
    
    // Create client using generated service definition
    this.client = createClient(ContextService, this.transport)
  }
  
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
 * Factory functions for creating clients
 */
export function createExecutionServiceClient(
  baseUrl: string,
  headers: Record<string, string> = {}
): GeneratedExecutionServiceClient {
  if (!baseUrl) {
    throw new Error('baseUrl is required for Connect client')
  }
  
  // Ensure baseUrl has protocol
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error('baseUrl must include protocol (http:// or https://)')
  }
  
  return new GeneratedExecutionServiceClient(baseUrl, headers)
}

export function createContextServiceClient(
  baseUrl: string,
  headers: Record<string, string> = {}
): GeneratedContextServiceClient {
  if (!baseUrl) {
    throw new Error('baseUrl is required for Connect client')
  }
  
  // Ensure baseUrl has protocol
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error('baseUrl must include protocol (http:// or https://)')
  }
  
  return new GeneratedContextServiceClient(baseUrl, headers)
}

/**
 * Re-export error handling from Connect
 */
export { Code, ConnectError } from '@connectrpc/connect'
export function handleConnectError(err: unknown): Error {
  // Connect errors are already well-formatted
  if (err instanceof Error) {
    return err
  }
  return new Error(String(err))
}