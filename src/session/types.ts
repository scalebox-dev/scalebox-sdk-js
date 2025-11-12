/**
 * High-Level Scalebox API Types
 * 
 * This module provides type definitions for the high-level Scalebox execution API.
 * It abstracts away the complexity of sandbox lifecycle management, file uploads,
 * and dependency installation.
 */

import type { Sandbox } from '../sandbox'

/**
 * Execution stage enumeration
 * 
 * Represents different phases of code execution lifecycle
 */
export type ExecutionStage =
  | 'initializing'    // Initializing execution environment
  | 'connecting'      // Connecting to or creating sandbox
  | 'uploading'       // Uploading files to sandbox
  | 'installing'      // Installing dependencies
  | 'executing'       // Executing code
  | 'downloading'     // Downloading result files
  | 'completed'       // Execution completed successfully
  | 'failed'          // Execution failed

/**
 * Programming language support
 * 
 * Note: This should match the Language type in code-interpreter/types.ts
 */
export type Language = 'python' | 'javascript' | 'typescript' | 'r' | 'java' | 'bash' | 'node' | 'nodejs' | 'deno'

/**
 * Progress information for real-time feedback
 * 
 * Provides detailed progress updates during code execution
 */
export interface ProgressInfo {
  /** Current execution stage */
  stage: ExecutionStage
  
  /** Progress percentage (0-100) */
  percent: number
  
  /** Human-readable progress message */
  message: string
  
  /** When the current stage started */
  stageStartedAt: Date
  
  /** Time elapsed in current stage (milliseconds) */
  stageElapsedMs: number
  
  /** Total time elapsed since execution started (milliseconds) */
  totalElapsedMs: number
  
  /** Optional detailed information */
  details?: {
    filesUploaded?: number
    totalFiles?: number
    packagesInstalled?: number
    totalPackages?: number
    bytesTransferred?: number
    output?: string
  }
}

/**
 * Execution request configuration
 * 
 * Main interface for executing code with automatic lifecycle management
 */
export interface ExecutionRequest {
  // ===== Core =====
  /** Code to execute */
  code: string
  
  /** Programming language (default: 'python') */
  language?: Language
  
  // ===== Files and Dependencies (automatically handled) =====
  /**
   * Files to upload to sandbox (path -> content mapping)
   * 
   * Path resolution:
   * - Absolute paths (starting with /): uploaded to exact location
   * - Relative paths: resolved relative to `cwd` (default: /workspace)
   * 
   * Example:
   * ```
   * files: {
   *   '/tmp/data.csv': csvData,        // Uploaded to /tmp/data.csv
   *   'config.json': configData         // Uploaded to /workspace/config.json (if cwd=/workspace)
   * }
   * ```
   * 
   * Important: Ensure your code uses paths consistent with upload locations
   */
  files?: Record<string, string | Buffer>
  
  /** Packages to install (language-specific) */
  packages?: string[]
  
  /** Environment variables */
  env?: Record<string, string>
  
  /** 
   * Working directory for code execution (default: /workspace)
   * 
   * Also used as base path for resolving relative file paths in `files` and `downloadFiles`
   * 
   * Note: The default value is defined as DEFAULT_CWD constant in executor.ts
   */
  cwd?: string
  
  // ===== Session Management =====
  /** Session ID to reuse existing sandbox */
  sessionId?: string
  
  /** Keep sandbox alive after execution (default: false) */
  keepAlive?: boolean
  
  /** Sandbox timeout in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number
  
  // ===== Output and Progress =====
  /**
   * Files to download after execution
   * 
   * Path resolution (same as `files`):
   * - Absolute paths: downloaded from exact location
   * - Relative paths: resolved relative to `cwd` (default: /workspace)
   * 
   * Example:
   * ```
   * downloadFiles: ['output.png', '/tmp/result.json']
   * // Downloads: /workspace/output.png and /tmp/result.json (if cwd=/workspace)
   * ```
   */
  downloadFiles?: string[]
  
  /** Real-time stdout callback */
  onStdout?: (output: string) => void
  
  /** Real-time stderr callback */
  onStderr?: (output: string) => void
  
  /** Real-time progress callback */
  onProgress?: (progress: ProgressInfo) => void
}

/**
 * Timing statistics for execution
 * 
 * Provides detailed breakdown of time spent in each stage
 */
export interface ExecutionTiming {
  /** Total execution time (milliseconds) */
  totalMs: number
  
  /** Execution start time */
  startedAt: Date
  
  /** Execution completion time */
  completedAt: Date
  
  /** Time spent in each stage (milliseconds) */
  stages: {
    initializing?: number
    connecting?: number
    uploading?: number
    installing?: number
    executing?: number
    downloading?: number
  }
  
  /** Percentage distribution of time across stages */
  distribution: {
    initializing: number
    connecting: number
    uploading: number
    installing: number
    executing: number
    downloading: number
  }
}

/**
 * Performance insights and optimization suggestions
 */
export interface ExecutionInsights {
  /** The slowest stage (bottleneck) */
  bottleneck?: ExecutionStage
  
  /** Optimization suggestions based on execution profile */
  suggestions?: string[]
}

/**
 * Execution response with results and statistics
 * 
 * Contains execution output, timing information, and performance insights
 */
export interface ExecutionResponse {
  // ===== Basic Output =====
  /** Primary output text */
  text: string
  
  /** Standard output */
  stdout: string
  
  /** Standard error */
  stderr: string
  
  /** Execution success status */
  success: boolean
  
  /** Exit code */
  exitCode: number
  
  /** Error information (if execution failed) */
  error?: {
    name: string
    value: string
    message: string
    stack?: string
    traceback?: string
  }
  
  // ===== Files =====
  /** Downloaded files (if requested) */
  files?: Record<string, Buffer>
  
  // ===== Session Information (two entry points) =====
  /** Session ID for reuse (if keepAlive=true) */
  sessionId?: string
  
  /** Direct Sandbox reference for advanced users (if keepAlive=true) */
  sandbox?: Sandbox
  
  // ===== Timing and Performance =====
  /** Detailed timing statistics */
  timing: ExecutionTiming
  
  /** Performance insights and suggestions */
  insights?: ExecutionInsights
}

/**
 * Session information for monitoring
 */
export interface SessionInfo {
  /** Session identifier */
  sessionId: string
  
  /** Underlying sandbox ID */
  sandboxId: string
  
  /** Programming language */
  language: string
  
  // ===== Session Layer State =====
  /** Installed packages (cached) */
  installedPackages: string[]
  
  /** Uploaded files (cached) */
  uploadedFiles: string[]
  
  /** Session creation time */
  createdAt: Date
  
  // ===== Sandbox Layer State (queried from sandbox) =====
  /** Sandbox status */
  status: 'running' | 'paused' | 'stopped'
  
  /** CPU usage percentage */
  cpuUsage?: number
  
  /** Memory usage in MB */
  memoryUsage?: number
  
  /** Sandbox start time */
  startedAt: Date
  
  /** Sandbox expiration time */
  expiresAt?: Date
  
  /** Remaining time in milliseconds */
  remainingTime?: number
  
  // ===== Entry Point to Sandbox Layer =====
  /** Direct sandbox reference for advanced operations */
  sandbox: Sandbox
}

/**
 * Session renewal response
 */
export interface SessionRenewalInfo {
  /** Session identifier */
  sessionId: string
  
  /** New timeout value (milliseconds) */
  newTimeout: number
  
  /** New expiration time */
  expiresAt: Date
}

