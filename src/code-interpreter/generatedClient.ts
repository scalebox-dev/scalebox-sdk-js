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
  type ExecuteResponse,
  type Chart as ProtoChart,
  type ChartElement as ProtoChartElement,
  type PointData as ProtoPointData,
  type Point as ProtoPoint,
  type BarData as ProtoBarData,
  type PieData as ProtoPieData,
  type BoxAndWhiskerData as ProtoBoxAndWhiskerData
} from '../generated/api_pb.js'
import type { 
  CodeContext, 
  ExecutionResponse, 
  ExecutionStream, 
  ChartTypes,
  PointChart,
  BarChart,
  PieChart,
  BoxAndWhiskerChart,
  SuperChart,
  ChartType
} from './types'

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
 * Convert protobuf Point to our Point format
 */
function convertProtoPoint(point: ProtoPoint): { x: string | number; y: string | number } {
  let x: string | number = 0
  let y: string | number = 0
  
  if (point.xValue.case === 'xStr') {
    x = point.xValue.value
  } else if (point.xValue.case === 'xNum') {
    x = point.xValue.value
  }
  
  if (point.yValue.case === 'yStr') {
    y = point.yValue.value
  } else if (point.yValue.case === 'yNum') {
    y = point.yValue.value
  }
  
  return { x, y }
}

/**
 * Convert protobuf Chart to our ChartTypes format
 */
function convertProtoChart(protoChart?: ProtoChart): ChartTypes | undefined {
  if (!protoChart) return undefined
  
  const type = protoChart.type.toLowerCase() as ChartType
  const title = protoChart.title || ''
  
  const elements: any[] = []
  for (const element of protoChart.elements) {
    if (element.element.case === 'pointData') {
      const pointData = element.element.value
      elements.push({
        label: pointData.label || '',
        points: pointData.points.map(convertProtoPoint)
      })
    } else if (element.element.case === 'barData') {
      const barData = element.element.value
      elements.push({
        label: barData.label || '',
        group: barData.group || '',
        value: barData.value || ''
      })
    } else if (element.element.case === 'pieData') {
      const pieData = element.element.value
      elements.push({
        label: pieData.label || '',
        angle: pieData.angle || 0,
        radius: pieData.radius || 0
      })
    } else if (element.element.case === 'boxWhiskerData') {
      const boxData = element.element.value
      elements.push({
        label: boxData.label || '',
        min: boxData.min || 0,
        firstQuartile: boxData.firstQuartile || 0,
        median: boxData.median || 0,
        thirdQuartile: boxData.thirdQuartile || 0,
        max: boxData.max || 0,
        outliers: boxData.outliers || []
      })
    } else if (element.element.case === 'nestedChart') {
      const nestedChart = convertProtoChart(element.element.value)
      if (nestedChart) {
        elements.push(nestedChart)
      }
    }
  }
  
  switch (type) {
    case 'line':
    case 'scatter':
      return {
        type: type as 'line' | 'scatter',
        title,
        elements,
        xLabel: protoChart.extra?.['xLabel'] || protoChart.extra?.['x_label'],
        yLabel: protoChart.extra?.['yLabel'] || protoChart.extra?.['y_label'],
        xUnit: protoChart.extra?.['xUnit'] || protoChart.extra?.['x_unit'],
        yUnit: protoChart.extra?.['yUnit'] || protoChart.extra?.['y_unit'],
        xTicks: [],
        xTickLabels: [],
        xScale: (protoChart.extra?.['xScale'] || protoChart.extra?.['x_scale'] || 'linear') as any,
        yTicks: [],
        yTickLabels: [],
        yScale: (protoChart.extra?.['yScale'] || protoChart.extra?.['y_scale'] || 'linear') as any
      } as PointChart
      
    case 'bar':
      return {
        type: 'bar',
        title,
        elements,
        xLabel: protoChart.extra?.['xLabel'] || protoChart.extra?.['x_label'],
        yLabel: protoChart.extra?.['yLabel'] || protoChart.extra?.['y_label'],
        xUnit: protoChart.extra?.['xUnit'] || protoChart.extra?.['x_unit'],
        yUnit: protoChart.extra?.['yUnit'] || protoChart.extra?.['y_unit']
      } as BarChart
      
    case 'pie':
      return {
        type: 'pie',
        title,
        elements
      } as PieChart
      
    case 'box_and_whisker':
      return {
        type: 'box_and_whisker',
        title,
        elements,
        xLabel: protoChart.extra?.['xLabel'] || protoChart.extra?.['x_label'],
        yLabel: protoChart.extra?.['yLabel'] || protoChart.extra?.['y_label'],
        xUnit: protoChart.extra?.['xUnit'] || protoChart.extra?.['x_unit'],
        yUnit: protoChart.extra?.['yUnit'] || protoChart.extra?.['y_unit']
      } as BoxAndWhiskerChart
      
    case 'superchart':
      return {
        type: 'superchart',
        title,
        elements: elements as ChartTypes[]
      } as SuperChart
      
    default:
      console.warn(`Unknown chart type: ${type}`)
      return undefined
  }
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
        // Convert protobuf Chart to our ChartTypes
        chart: convertProtoChart(res.chart),
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