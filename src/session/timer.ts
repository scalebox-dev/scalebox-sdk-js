/**
 * Execution Timer
 * 
 * Tracks execution progress and timing across different stages.
 * Provides real-time progress updates and detailed timing statistics.
 */

import type { ExecutionInsights, ExecutionStage, ExecutionTiming, ProgressInfo } from './types'

/**
 * Stage information for internal tracking
 */
interface StageInfo {
  start: number
  end?: number
}

/**
 * ExecutionTimer class
 * 
 * Manages timing and progress tracking for code execution.
 * Supports real-time progress callbacks and generates detailed statistics.
 * 
 * @example
 * ```typescript
 * const timer = new ExecutionTimer((progress) => {
 *   console.log(`[${progress.stage}] ${progress.percent}% - ${progress.message}`)
 * })
 * 
 * timer.startStage('connecting')
 * // ... perform operations
 * timer.updateProgress(50, 'Creating sandbox')
 * timer.endStage('connecting')
 * 
 * const stats = timer.getStats()
 * console.log(`Total time: ${stats.totalMs}ms`)
 * ```
 */
export class ExecutionTimer {
  private startTime: Date
  private stages: Map<ExecutionStage, StageInfo> = new Map()
  private currentStage?: ExecutionStage
  private onProgress?: (progress: ProgressInfo) => void
  
  /**
   * Create a new execution timer
   * 
   * @param onProgress Optional callback for real-time progress updates
   */
  constructor(onProgress?: (progress: ProgressInfo) => void) {
    this.startTime = new Date()
    this.onProgress = onProgress
  }
  
  /**
   * Start a new execution stage
   * 
   * Automatically ends the previous stage if one is active.
   * 
   * @param stage Stage to start
   * @param message Optional custom message (defaults to stage-specific message)
   */
  startStage(stage: ExecutionStage, message?: string): void {
    // End previous stage
    if (this.currentStage) {
      this.endStage(this.currentStage)
    }
    
    this.currentStage = stage
    this.stages.set(stage, { start: Date.now() })
    
    // Notify progress at 0%
    this.notifyProgress(stage, 0, message || this.getDefaultMessage(stage))
  }
  
  /**
   * Update progress for current stage
   * 
   * @param percent Progress percentage (0-100)
   * @param message Optional progress message
   * @param details Optional detailed information
   */
  updateProgress(percent: number, message?: string, details?: any): void {
    if (!this.currentStage) return
    
    this.notifyProgress(
      this.currentStage,
      Math.min(100, Math.max(0, percent)),
      message || this.getDefaultMessage(this.currentStage),
      details
    )
  }
  
  /**
   * End a stage
   * 
   * Records the end time and notifies 100% completion.
   * 
   * @param stage Stage to end
   */
  endStage(stage: ExecutionStage): void {
    const stageInfo = this.stages.get(stage)
    if (stageInfo && !stageInfo.end) {
      stageInfo.end = Date.now()
      
      // Notify 100% completion
      this.notifyProgress(stage, 100, `${this.getDefaultMessage(stage)} completed`)
    }
  }
  
  /**
   * Get execution statistics
   * 
   * Calculates timing breakdown and percentage distribution across stages.
   * 
   * @returns Detailed timing statistics
   */
  getStats(): ExecutionTiming {
    const now = Date.now()
    const totalMs = now - this.startTime.getTime()
    
    const stages: Record<string, number> = {}
    
    // Calculate duration for each stage
    for (const [stage, info] of this.stages) {
      const duration = (info.end || now) - info.start
      stages[stage] = duration
    }
    
    // Calculate percentage distribution
    const distribution = {
      initializing: 0,
      connecting: 0,
      uploading: 0,
      installing: 0,
      executing: 0,
      downloading: 0
    }
    
    if (totalMs > 0) {
      for (const [stage, duration] of Object.entries(stages)) {
        if (stage in distribution) {
          distribution[stage as keyof typeof distribution] = (duration / totalMs) * 100
        }
      }
    }
    
    return {
      totalMs,
      startedAt: this.startTime,
      completedAt: new Date(),
      stages,
      distribution
    }
  }
  
  /**
   * Generate performance insights
   * 
   * Analyzes timing statistics to identify bottlenecks and provide
   * optimization suggestions.
   * 
   * @returns Performance insights and suggestions
   */
  getInsights(): ExecutionInsights {
    const stats = this.getStats()
    const stages = stats.stages
    
    // Find bottleneck (slowest stage)
    let bottleneck: ExecutionStage | undefined
    let maxDuration = 0
    
    for (const [stage, duration] of Object.entries(stages)) {
      if (duration > maxDuration) {
        maxDuration = duration
        bottleneck = stage as ExecutionStage
      }
    }
    
    // Generate optimization suggestions
    const suggestions: string[] = []
    
    if (bottleneck === 'uploading' && stages.uploading! > 5000) {
      suggestions.push('Consider reducing file sizes or uploading fewer files')
      suggestions.push('Large files can be uploaded once and reused across executions with keepAlive=true')
    }
    
    if (bottleneck === 'installing' && stages.installing! > 30000) {
      suggestions.push('Dependencies are installed per session - reuse sessions to avoid reinstallation')
      suggestions.push('Consider using a custom template with pre-installed dependencies')
      suggestions.push('Keep sessions alive with keepAlive=true for multi-step workflows')
    }
    
    if (bottleneck === 'executing' && stages.executing! > 60000) {
      suggestions.push('Long execution time detected - consider breaking into smaller steps')
      suggestions.push('Use keepAlive=true to maintain session state for multi-step workflows')
    }
    
    if (bottleneck === 'connecting' && stages.connecting! > 10000) {
      suggestions.push('Sandbox creation is slow - consider keeping sessions alive for reuse')
      suggestions.push('Reusing sessions can be 10-100x faster than creating new ones')
    }
    
    if (bottleneck === 'downloading' && stages.downloading! > 10000) {
      suggestions.push('Consider downloading only necessary files')
      suggestions.push('Large result files can be accessed via sandbox.files.read() later')
    }
    
    return {
      bottleneck,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    }
  }
  
  /**
   * Notify progress to callback
   */
  private notifyProgress(
    stage: ExecutionStage,
    percent: number,
    message: string,
    details?: any
  ): void {
    if (!this.onProgress) return
    
    const stageInfo = this.stages.get(stage)
    const stageStartedAt = stageInfo ? new Date(stageInfo.start) : new Date()
    const stageElapsedMs = stageInfo ? Date.now() - stageInfo.start : 0
    const totalElapsedMs = Date.now() - this.startTime.getTime()
    
    this.onProgress({
      stage,
      percent,
      message,
      stageStartedAt,
      stageElapsedMs,
      totalElapsedMs,
      details
    })
  }
  
  /**
   * Get default message for a stage
   */
  private getDefaultMessage(stage: ExecutionStage): string {
    const messages: Record<ExecutionStage, string> = {
      initializing: 'Initializing execution environment',
      connecting: 'Connecting to sandbox',
      uploading: 'Uploading files',
      installing: 'Installing dependencies',
      executing: 'Executing code',
      downloading: 'Downloading results',
      completed: 'Execution completed',
      failed: 'Execution failed'
    }
    return messages[stage]
  }
  
  /**
   * Format bytes to human-readable string
   * 
   * @param bytes Number of bytes
   * @returns Formatted string (e.g., "1.23 MB")
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
}

