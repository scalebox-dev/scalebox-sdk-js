/**
 * Output parser - Corresponds to Python version's parse_output function
 * Parses response streams from gRPC execution service
 * 
 * This module handles the parsing and aggregation of execution responses
 * from the gRPC stream into a structured format. It supports:
 * 
 * - Real-time streaming of stdout/stderr
 * - Rich media result parsing (images, charts, HTML, etc.)
 * - Error tracking and reporting
 * - Execution metadata aggregation
 * - Callback handlers for asynchronous processing
 * 
 * Key Components:
 * - Logs: Aggregates stdout and stderr streams
 * - Execution: Aggregates all execution data
 * - parseOutput: Main parsing function
 * - executionToResult: Converts execution to final result
 */

import { ChartType } from './types'
import type {
  ChartTypes,
  ExecutionError,
  ExecutionResponse,
  ExecutionResult,
  OutputHandler,
  OutputMessage,
  Result
} from './types'

/**
 * Log aggregator
 * 
 * Collects and stores stdout and stderr output from code execution.
 * Maintains separate arrays for each stream type to preserve ordering
 * and allow separate processing.
 */
export class Logs {
  /** Array of stdout messages in order received */
  public stdout: string[] = []
  
  /** Array of stderr messages in order received */
  public stderr: string[] = []

  constructor(stdout: string[] = [], stderr: string[] = []) {
    this.stdout = stdout
    this.stderr = stderr
  }

  /**
   * Serialize logs to JSON string
   * @returns JSON representation of logs
   */
  toJson(): string {
    return JSON.stringify({
      stdout: this.stdout,
      stderr: this.stderr
    })
  }
}

/**
 * Execution aggregator
 * 
 * Accumulates all data from a code execution stream into a structured format.
 * This includes:
 * - Multiple results (rich media outputs)
 * - Standard output/error logs
 * - Error information if execution failed
 * - Execution count for tracking
 * 
 * The Execution object is progressively built as events arrive from the
 * streaming gRPC response. Once the stream completes, it can be converted
 * to an ExecutionResult for the user.
 */
export class Execution {
  /** Array of rich media results from the execution */
  public results: Result[] = []
  
  /** Aggregated stdout/stderr logs */
  public logs: Logs = new Logs()
  
  /** Error information if execution failed */
  public error?: ExecutionError
  
  /** Execution count (similar to Jupyter's execution counter) */
  public executionCount?: number

  constructor(
    results: Result[] = [],
    logs: Logs = new Logs(),
    error?: ExecutionError,
    executionCount?: number
  ) {
    this.results = results
    this.logs = logs
    this.error = error
    this.executionCount = executionCount
  }

  /**
   * Get text content of main result
   * 
   * The main result is typically the final expression value in the code,
   * similar to Jupyter's output display logic.
   * 
   * @returns Text content of the main result, or undefined if no main result
   */
  get text(): string | undefined {
    for (const result of this.results) {
      if (result.isMainResult) {
        return result.text
      }
    }
    return undefined
  }

  toJson(): string {
    return JSON.stringify({
      results: this.results.map(r => this.serializeResult(r)),
      logs: JSON.parse(this.logs.toJson()),
      error: this.error ? this.serializeError(this.error) : undefined,
      executionCount: this.executionCount
    })
  }

  private serializeResult(result: Result): Record<string, any> {
    const serialized: Record<string, any> = {
      text: result.text,
      html: result.html,
      markdown: result.markdown,
      svg: result.svg,
      png: result.png,
      jpeg: result.jpeg,
      pdf: result.pdf,
      latex: result.latex,
      json: result.json,
      javascript: result.javascript,
      data: result.data,
      executionCount: result.executionCount,
      isMainResult: result.isMainResult,
      extra: result.extra
    }

    // Remove undefined values
    return Object.fromEntries(
      Object.entries(serialized).filter(([, value]) => value !== undefined)
    )
  }

  private serializeError(error: ExecutionError): Record<string, any> {
    return {
      name: error.name,
      value: error.value,
      message: error.message,
      traceback: error.traceback
    }
  }
}

/**
 * Parse execution response and update execution object
 * 
 * This is the main parsing function that processes streaming gRPC responses
 * and updates the Execution aggregator. It handles four types of events:
 * 
 * 1. stdout: Standard output text
 * 2. stderr: Standard error text
 * 3. result: Rich media output (images, charts, HTML, etc.)
 * 4. error: Execution error with traceback
 * 
 * For each event type, it:
 * - Updates the Execution object with the new data
 * - Calls the appropriate handler callback if provided
 * 
 * Handlers are called asynchronously and errors in handlers are caught
 * and logged to prevent them from affecting the parsing process.
 * 
 * This function corresponds to the Python SDK's parse_output function
 * and follows the same event processing logic.
 * 
 * @param execution - Execution object to update with parsed data
 * @param response - Response event from the gRPC stream
 * @param handlers - Optional callback handlers for real-time processing
 * @throws Never throws - all errors are caught and handled internally
 */
export async function parseOutput(
  execution: Execution,
  response: ExecutionResponse,
  handlers?: {
    onStdout?: OutputHandler<OutputMessage>
    onStderr?: OutputHandler<OutputMessage>
    onResult?: OutputHandler<Result>
    onError?: OutputHandler<ExecutionError>
  }
): Promise<void> {
  try {
    // Process standard output
    if (response.stdout?.content) {
      const content = response.stdout.content
      execution.logs.stdout.push(content)
      
      if (handlers?.onStdout) {
        const message: OutputMessage = {
          content,
          timestamp: new Date(),
          type: 'stdout',
          error: false
        }
        await safeCallHandler(handlers.onStdout, message)
      }
    }

    // Process standard error
    if (response.stderr?.content) {
      const content = response.stderr.content
      execution.logs.stderr.push(content)
      
      if (handlers?.onStderr) {
        const message: OutputMessage = {
          content,
          timestamp: new Date(),
          type: 'stderr',
          error: true
        }
        await safeCallHandler(handlers.onStderr, message)
      }
    }

    // Process execution result
    if (response.result) {
      const resultData = response.result
      const result: Result = {
        text: resultData.text,
        html: resultData.html,
        markdown: resultData.markdown,
        svg: resultData.svg,
        png: resultData.png,
        jpeg: resultData.jpeg,
        pdf: resultData.pdf,
        latex: resultData.latex,
        json: resultData.json,
        javascript: resultData.javascript,
        data: resultData.data,
        chart: resultData.chart,
        executionCount: resultData.executionCount,
        isMainResult: resultData.isMainResult || false,
        extra: resultData.extra || {}
      }

      execution.results.push(result)
      
      if (handlers?.onResult) {
        await safeCallHandler(handlers.onResult, result)
      }

      // Update main result's execution count
      if (result.isMainResult && result.executionCount !== undefined) {
        execution.executionCount = result.executionCount
      }
    }

    // Process execution error
    if (response.error) {
      const errorData = response.error
      const error: ExecutionError = {
        name: errorData.name,
        value: errorData.value,
        message: errorData.value, // Use value as message
        traceback: errorData.traceback
      }

      execution.error = error
      
      if (handlers?.onError) {
        await safeCallHandler(handlers.onError, error)
      }
    }
  } catch (parseError) {
    console.error('Error parsing execution output:', parseError)
    
    // Create parsing error
    const error: ExecutionError = {
      name: 'ParseError',
      value: `Failed to parse execution output: ${parseError}`,
      message: `Failed to parse execution output: ${parseError}`,
      traceback: parseError instanceof Error ? parseError.stack : undefined
    }
    
    execution.error = error
    
    if (handlers?.onError) {
      await safeCallHandler(handlers.onError, error)
    }
  }
}

/**
 * Safely call handler function, supporting both synchronous and asynchronous functions
 */
async function safeCallHandler<T>(handler: OutputHandler<T>, data: T): Promise<void> {
  try {
    const result = handler(data)
    if (result instanceof Promise) {
      await result
    }
  } catch (error) {
    console.error('Error in output handler:', error)
  }
}

/**
 * Deserialize chart data
 */
export function deserializeChart(data?: any): ChartTypes | undefined {
  if (!data || typeof data !== 'object') {
    return undefined
  }

  const type = data.type as ChartType
  
  switch (type) {
    case ChartType.LINE:
    case ChartType.SCATTER:
      return {
        type,
        title: data.title || '',
        elements: data.elements || [],
        xLabel: data.xLabel,
        yLabel: data.yLabel,
        xUnit: data.xUnit,
        yUnit: data.yUnit,
        xTicks: data.xTicks || [],
        xTickLabels: data.xTickLabels || [],
        xScale: data.xScale || 'linear',
        yTicks: data.yTicks || [],
        yTickLabels: data.yTickLabels || [],
        yScale: data.yScale || 'linear'
      }
      
    case ChartType.BAR:
      return {
        type,
        title: data.title || '',
        elements: data.elements || [],
        xLabel: data.xLabel,
        yLabel: data.yLabel,
        xUnit: data.xUnit,
        yUnit: data.yUnit
      }
      
    case ChartType.PIE:
      return {
        type,
        title: data.title || '',
        elements: data.elements || []
      }
      
    case ChartType.BOX_AND_WHISKER:
      return {
        type,
        title: data.title || '',
        elements: data.elements || [],
        xLabel: data.xLabel,
        yLabel: data.yLabel,
        xUnit: data.xUnit,
        yUnit: data.yUnit
      }
      
    case ChartType.SUPERCHART:
      return {
        type,
        title: data.title || '',
        elements: (data.elements || []).map(deserializeChart).filter(Boolean) as ChartTypes[]
      }
      
    default:
      return undefined
  }
}

/**
 * Convert Execution object to ExecutionResult
 */
export function executionToResult(execution: Execution, language: string, context?: any): ExecutionResult {
  // Find main result with intelligent fallback:
  // 1. First try to find result explicitly marked as main
  // 2. If none, use first result with media content (png/svg/html/jpeg)
  //    This handles the case where backend doesn't mark display_data as main
  // Note: We don't fallback for text/markdown/json to preserve existing behavior
  let mainResult = execution.results.find(r => r.isMainResult)
  
  if (!mainResult && execution.results.length > 0) {
    // Fallback ONLY for media content (images, graphics, HTML)
    // This is to fix the issue where display_data (e.g., from IPython.display.Image)
    // is not marked as isMainResult by the backend
    mainResult = execution.results.find(r => r.png || r.svg || r.html || r.jpeg)
  }
  
  const hasError = execution.error !== undefined
  
  return {
    stdout: execution.logs.stdout.join(''),
    stderr: execution.logs.stderr.join(''),
    exitCode: hasError ? 1 : 0,
    error: execution.error,
    // Populate top-level convenience fields from main result
    text: mainResult?.text || execution.logs.stdout.join(''),
    png: mainResult?.png,
    svg: mainResult?.svg,
    html: mainResult?.html,
    logs: {
      stdout: execution.logs.stdout.join(''),
      stderr: execution.logs.stderr.join(''),
      output: [
        ...execution.logs.stdout.map(content => ({
          content,
          timestamp: new Date(),
          type: 'stdout' as const,
          error: false
        })),
        ...execution.logs.stderr.map(content => ({
          content,
          timestamp: new Date(),
          type: 'stderr' as const,
          error: true
        }))
      ],
      errors: execution.error ? [execution.error] : []
    },
    result: mainResult,
    results: execution.results,
    success: !hasError && execution.results.some(r => r.isMainResult || r.text),
    executionTime: 0, // Needs to be set at call site
    language: language as any,
    context
  }
}
