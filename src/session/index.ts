/**
 * High-Level Session API
 * 
 * This module provides a simplified, high-level API for stateful code execution
 * with automatic lifecycle management, intelligent caching, and detailed
 * progress tracking.
 * 
 * Key Features:
 * - Stateful session management (similar to Jupyter kernels)
 * - Smart file upload and dependency installation (with deduplication)
 * - Automatic session renewal (no manual timeout management needed)
 * - Real-time progress tracking with detailed timing statistics
 * - Two-level API: Session layer (simple) + Sandbox layer (advanced)
 * 
 * @example Simple execution
 * ```typescript
 * import { Session } from '@scalebox/sdk'
 * 
 * const result = await Session.run({
 *   code: 'print("Hello, World!")',
 *   language: 'python'
 * })
 * 
 * console.log(result.text)  // "Hello, World!\n"
 * ```
 * 
 * @example Multi-step workflow with session reuse
 * ```typescript
 * // Step 1: Initialize
 * const step1 = await Session.run({
 *   code: 'import pandas as pd',
 *   packages: ['pandas'],
 *   keepAlive: true
 * })
 * 
 * const sessionId = step1.sessionId!
 * 
 * // Step 2: Load data (session reused, pandas already installed)
 * const step2 = await Session.run({
 *   code: 'df = pd.read_csv("data.csv")',
 *   sessionId,
 *   files: { 'data.csv': csvData },
 *   keepAlive: true
 * })
 * 
 * // Step 3: Analyze (automatic session renewal if needed)
 * const step3 = await Session.run({
 *   code: 'print(df.describe())',
 *   sessionId
 * })
 * ```
 */

import { SessionExecutor } from './executor'
import type {
  ExecutionRequest,
  ExecutionResponse,
  SessionInfo,
  SessionRenewalInfo
} from './types'

/**
 * Session - High-Level Stateful Code Execution API
 * 
 * Main entry point for stateful code execution with automatic
 * lifecycle management and intelligent optimization.
 * 
 * Similar to Jupyter kernels, sessions maintain state across multiple
 * code executions, making multi-step workflows 10-100x faster.
 * 
 * Architecture:
 * - Session Layer: High-level abstraction with smart automation
 * - Sandbox Layer: Low-level control with full capabilities
 * - Delegation: Session delegates all lifecycle management to Sandbox
 * - Two Entry Points: Use sessionId for simple cases, sandbox for advanced
 */
export class Session {
  /**
   * Execute code with automatic lifecycle management
   * 
   * This is the main method for code execution. It automatically handles:
   * - Sandbox creation or connection
   * - File uploads (with smart deduplication)
   * - Dependency installation (with smart deduplication)
   * - Code execution with real-time output
   * - Result file downloads
   * - Automatic session renewal (when remaining time < 2 minutes)
   * - Resource cleanup or session persistence
   * 
   * @param request Execution configuration
   * @returns Execution results with timing statistics and performance insights
   * 
   * @example One-time execution
   * ```typescript
   * const result = await Session.execute({
   *   code: `
   *     import pandas as pd
   *     df = pd.read_csv('data.csv')
   *     print(df.describe())
   *   `,
   *   files: { 'data.csv': csvData },
   *   packages: ['pandas']
   * })
   * // Sandbox automatically created and destroyed
   * ```
   * 
   * @example Session reuse for multi-step workflows
   * ```typescript
   * // Create session
   * const result1 = await Session.execute({
   *   code: 'x = 42',
   *   keepAlive: true
   * })
   * 
   * // Reuse session (variable x persists)
   * const result2 = await Session.execute({
   *   code: 'print(x * 2)',
   *   sessionId: result1.sessionId
   * })
   * // Output: 84
   * ```
   * 
   * @example Progress tracking
   * ```typescript
   * const result = await Session.execute({
   *   code: 'print("Hello")',
   *   onProgress: (progress) => {
   *     console.log(`[${progress.stage}] ${progress.percent}%`)
   *     console.log(progress.message)
   *   }
   * })
   * ```
   * 
   * @example Advanced: Direct sandbox access
   * ```typescript
   * const result = await Session.execute({
   *   code: 'print("Hello")',
   *   keepAlive: true
   * })
   * 
   * // Access underlying sandbox for advanced operations
   * const sandbox = result.sandbox!
   * await sandbox.files.write('/custom/path', content)
   * const metrics = await sandbox.getMetrics()
   * ```
   */
  static async run(request: ExecutionRequest): Promise<ExecutionResponse> {
    return SessionExecutor.execute(request)
  }
  
  /**
   * Extend session timeout (manual renewal)
   * 
   * Manually extends the session timeout. This is useful when:
   * - You know a long-running operation is coming
   * - Automatic renewal (2-minute threshold) is not sufficient
   * - You want explicit control over session lifetime
   * 
   * Note: Automatic renewal happens when remaining time < 2 minutes,
   * so manual renewal is rarely needed for typical workflows.
   * 
   * @param sessionId Session identifier
   * @param timeoutMs Timeout duration in milliseconds (default: 600000 = 10 minutes)
   * @returns Renewal information with new expiration time
   * 
   * @example
   * ```typescript
   * const result = await Session.execute({
   *   code: 'import tensorflow as tf',
   *   keepAlive: true
   * })
   * 
   * // Extend timeout before long operation
   * await Session.keepAlive(result.sessionId!, 1800000)  // 30 minutes
   * 
   * // Run long training
   * await Session.execute({
   *   code: 'model.fit(X_train, y_train, epochs=100)',
   *   sessionId: result.sessionId
   * })
   * ```
   */
  static async keepAlive(
    sessionId: string,
    timeoutMs?: number
  ): Promise<SessionRenewalInfo> {
    return SessionExecutor.keepAlive(sessionId, timeoutMs)
  }
  
  /**
   * Get detailed session information
   * 
   * Retrieves comprehensive session information including:
   * - Session metadata (language, creation time)
   * - Cached state (installed packages, uploaded files)
   * - Real-time sandbox status (CPU, memory, expiration)
   * - Direct sandbox reference for advanced operations
   * 
   * @param sessionId Session identifier
   * @returns Complete session information
   * 
   * @example Basic monitoring
   * ```typescript
   * const info = await Session.getSession(sessionId)
   * 
   * console.log('Status:', info.status)
   * console.log('Expires at:', info.expiresAt)
   * console.log('Remaining:', info.remainingTime, 'ms')
   * console.log('Installed packages:', info.installedPackages)
   * ```
   * 
   * @example Advanced: Direct sandbox operations
   * ```typescript
   * const info = await Session.getSession(sessionId)
   * 
   * // Use sandbox directly for advanced operations
   * const metrics = await info.sandbox.getMetrics()
   * console.log(`CPU: ${metrics.cpuPercent}%`)
   * console.log(`Memory: ${metrics.memoryMb}MB`)
   * 
   * // Direct file operations
   * const files = await info.sandbox.files.list('/workspace')
   * ```
   */
  static async getSession(sessionId: string): Promise<SessionInfo> {
    return SessionExecutor.getSession(sessionId)
  }
  
  /**
   * List all active sessions
   * 
   * Returns a list of all currently active sessions with basic information.
   * Useful for monitoring and management.
   * 
   * @returns List of session summaries
   * 
   * @example
   * ```typescript
   * const sessions = await Session.listSessions()
   * 
   * for (const session of sessions) {
   *   console.log(`Session ${session.sessionId}:`)
   *   console.log(`  Language: ${session.language}`)
   *   console.log(`  Created: ${session.createdAt}`)
   *   console.log(`  Expires: ${session.expiresAt}`)
   * }
   * ```
   */
  static async listSessions(): Promise<Array<{
    sessionId: string
    sandboxId: string
    language: string
    createdAt: Date
    expiresAt?: Date
  }>> {
    return SessionExecutor.listSessions()
  }
  
  /**
   * Pause session to save resources
   * 
   * Pauses the underlying sandbox, which stops consuming compute resources
   * (CPU, memory) while preserving the session state (files, installed packages, etc.).
   * 
   * **Use cases:**
   * - Long idle periods between executions
   * - Cost optimization (paused sandboxes don't consume compute resources)
   * - Batch processing with gaps
   * 
   * **Important notes:**
   * - Session state (variables, files, packages) is preserved
   * - The session will be **automatically resumed** when you call `Session.run()` with the same sessionId
   * - No manual resume needed - `Session.run()` handles it automatically
   * - For advanced control, access the underlying sandbox via `Session.getSession().sandbox`
   * 
   * @param sessionId Session identifier
   * @returns `true` if paused successfully, `false` if already paused
   * 
   * @example Cost optimization
   * ```typescript
   * const result = await Session.run({
   *   code: 'import pandas as pd; df = pd.read_csv("data.csv")',
   *   files: { 'data.csv': csvData },
   *   packages: ['pandas'],
   *   keepAlive: true
   * })
   * 
   * // Pause to save resources during long wait for external data
   * await Session.pause(result.sessionId!)
   * 
   * // Later: automatically resumed when reusing
   * await Session.run({
   *   code: 'print(df.describe())',
   *   sessionId: result.sessionId  // ✅ Automatically resumes
   * })
   * ```
   * 
   * @example Advanced: Direct sandbox access
   * ```typescript
   * const info = await Session.getSession(sessionId)
   * await info.sandbox.betaPause()  // Pause via sandbox
   * 
   * // Resume via sandbox (if needed, though Session.run() does this automatically)
   * await info.sandbox.connect({ timeoutMs: 1800000 })
   * ```
   */
  static async pause(sessionId: string): Promise<boolean> {
    return SessionExecutor.pause(sessionId)
  }
  
  /**
   * Close session and cleanup resources
   * 
   * Manually closes a session and destroys the underlying sandbox.
   * Resources are freed immediately.
   * 
   * Note: Sessions with keepAlive=false are automatically closed
   * after execution, so manual closing is only needed for:
   * - Sessions kept alive with keepAlive=true
   * - Early termination of long-running sessions
   * 
   * @param sessionId Session identifier
   * 
   * @example
   * ```typescript
   * const result = await Session.run({
   *   code: 'print("Hello")',
   *   keepAlive: true
   * })
   * 
   * // ... do some work ...
   * 
   * // Clean up when done
   * await Session.close(result.sessionId!)
   * ```
   */
  static async close(sessionId: string): Promise<void> {
    return SessionExecutor.close(sessionId)
  }
}

// Re-export types for convenience
export * from './types'
export { ExecutionTimer } from './timer'
export { SessionExecutor } from './executor'

