/**
 * Scalebox Executor
 * 
 * Core execution engine that manages sandbox lifecycle, file uploads,
 * dependency installation, and code execution with intelligent caching.
 */

import { ApiClient } from '../api'
import { CodeInterpreter } from '../code-interpreter'
import type { CodeContext } from '../code-interpreter/types'
import { ConnectionConfig } from '../connectionConfig'
import { ScaleboxError } from '../errors'
import { Sandbox } from '../sandbox'
import { ExecutionTimer } from './timer'
import type { ExecutionRequest, ExecutionResponse, Language, SessionInfo, SessionRenewalInfo } from './types'

/**
 * Default working directory for code execution and file operations
 * 
 * This constant defines the base path used for:
 * - Resolving relative file paths in `files` parameter
 * - Setting the code execution working directory (cwd)
 * - Resolving relative paths in `downloadFiles` parameter
 * 
 * Keeping this as a constant ensures consistency across all file operations
 * and makes it easy to identify and modify if needed.
 */
const DEFAULT_CWD = '/workspace'

/**
 * Session state for internal tracking
 * 
 * Maintains session-level state without duplicating sandbox lifecycle management.
 * All lifecycle operations are delegated to the underlying Sandbox instance.
 */
interface SessionState {
  // Underlying components
  sandbox: Sandbox
  interpreter: CodeInterpreter
  context: CodeContext
  
  // Session-level caching (not duplicating sandbox state)
  installedPackages: Set<string>
  uploadedFiles: Set<string>
  
  // Metadata
  createdAt: Date
  language: Language
}

/**
 * SessionExecutor
 * 
 * High-level executor that provides automatic lifecycle management,
 * intelligent caching, and detailed progress tracking.
 * 
 * Key Features:
 * - Automatic sandbox lifecycle management
 * - Smart file upload (deduplication)
 * - Smart package installation (deduplication)
 * - Automatic session renewal (when remaining time < 2 minutes)
 * - Detailed timing and performance insights
 * - Two-level API: Session layer (high-level) + Sandbox layer (low-level)
 * 
 * Architecture:
 * - Session layer: High-level abstraction with intelligent automation
 * - Sandbox layer: Low-level control with full capabilities
 * - Delegation: All lifecycle management delegated to Sandbox
 * - Single source of truth: Timeout and state managed by Sandbox only
 */
export class SessionExecutor {
  /**
   * Session cache
   * 
   * Key: sessionId (= sandboxId internally)
   * Value: SessionState with sandbox reference and caching metadata
   */
  private static sessions = new Map<string, SessionState>()
  
  /**
   * Execute code with automatic lifecycle management
   * 
   * This is the main entry point for high-level code execution.
   * Handles all lifecycle stages automatically:
   * 1. Initialize/connect to sandbox
   * 2. Upload files (smart deduplication)
   * 3. Install dependencies (smart deduplication)
   * 4. Execute code
   * 5. Download results
   * 6. Cleanup or keep alive based on configuration
   * 
   * @param request Execution request configuration
   * @returns Execution response with results and timing statistics
   */
  static async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    // Create execution timer for progress tracking
    const timer = new ExecutionTimer(request.onProgress)
    
    try {
      // 1️⃣ Initialize
      timer.startStage('initializing', 'Preparing execution environment')
      timer.updateProgress(100, 'Initialization complete')
      timer.endStage('initializing')
      
      // 2️⃣ Get or create session
      timer.startStage('connecting')
      const session = await this.getOrCreateSession(request, timer)
      timer.endStage('connecting')
      
      // 3️⃣ Upload files (with smart deduplication)
      if (request.files && Object.keys(request.files).length > 0) {
        timer.startStage('uploading')
        const cwd = request.cwd || DEFAULT_CWD
        await this.smartUploadFiles(session, request.files, cwd, timer)
        timer.endStage('uploading')
      }
      
      // 4️⃣ Install dependencies (with smart deduplication)
      if (request.packages && request.packages.length > 0) {
        timer.startStage('installing')
        await this.smartInstallPackages(session, request.packages, request.language, timer)
        timer.endStage('installing')
      }
      
      // 5️⃣ Execute code
      timer.startStage('executing', 'Running your code')
      
      const result = await session.interpreter.runCode(request.code, {
        language: request.language || session.language,
        context: session.context,
        envVars: request.env,
        cwd: request.cwd || DEFAULT_CWD,
        onStdout: (output) => {
          // output is OutputMessage, extract content
          const content = output.content || ''
          request.onStdout?.(content)
          timer.updateProgress(50, 'Executing...', { output: content.slice(0, 100) })
        },
        onStderr: (output) => {
          // output is OutputMessage, extract content
          const content = output.content || ''
          request.onStderr?.(content)
        }
      })
      
      timer.updateProgress(100, 'Code execution completed')
      timer.endStage('executing')
      
      // 6️⃣ Download files
      const files: Record<string, Buffer> = {}
      if (request.downloadFiles && request.downloadFiles.length > 0) {
        timer.startStage('downloading')
        
        const cwd = request.cwd || DEFAULT_CWD
        const totalFiles = request.downloadFiles.length
        let downloadedFiles = 0
        let bytesTransferred = 0
        
        for (const path of request.downloadFiles) {
          timer.updateProgress(
            (downloadedFiles / totalFiles) * 100,
            `Downloading ${path}`,
            { filesDownloaded: downloadedFiles, totalFiles }
          )
          
          // Resolve file path: if absolute, use as-is; if relative, resolve against cwd
          const fullPath = path.startsWith('/') ? path : `${cwd}/${path}`.replace(/\/+/g, '/')
          
          // Read file as bytes to handle binary files correctly
          const content = await session.sandbox.files.read(fullPath, { format: 'bytes' })
          // Content is base64 encoded string, convert to Buffer
          const buffer = Buffer.from(content, 'base64')
          files[path] = buffer
          bytesTransferred += buffer.length
          downloadedFiles++
        }
        
        timer.updateProgress(
          100,
          `Downloaded ${totalFiles} files (${ExecutionTimer.formatBytes(bytesTransferred)})`
        )
        timer.endStage('downloading')
      }
      
      // 7️⃣ Complete
      timer.startStage('completed', 'Execution completed successfully')
      timer.endStage('completed')
      
      // Generate timing statistics and insights
      const timing = timer.getStats()
      const insights = timer.getInsights()
      
      // Return response with two entry points
      return {
        text: result.text || result.stdout,
        stdout: result.stdout,
        stderr: result.stderr,
        success: result.success,
        exitCode: result.exitCode,
        error: result.error,  // Include error information
        files: Object.keys(files).length > 0 ? files : undefined,
        
        // Two entry points for users
        sessionId: request.keepAlive ? session.sandbox.sandboxId : undefined,
        sandbox: request.keepAlive ? session.sandbox : undefined,
        
        timing,
        insights
      }
      
    } catch (error) {
      timer.startStage('failed', `Execution failed: ${error}`)
      throw error
    }
  }
  
  /**
   * Get or create session
   * 
   * If sessionId is provided, reuse existing session with automatic renewal.
   * Otherwise, create new session.
   */
  private static async getOrCreateSession(
    request: ExecutionRequest,
    timer: ExecutionTimer
  ): Promise<SessionState> {
    if (request.sessionId) {
      // Reuse existing session
      timer.updateProgress(30, 'Looking up existing session')
      
      const session = this.sessions.get(request.sessionId)
      if (!session) {
        throw new ScaleboxError(`Session ${request.sessionId} not found or expired`)
      }
      
      timer.updateProgress(60, 'Checking session health')
      
      // 🔥 Check if session is paused and auto-resume if needed
      const sandboxInfo = await session.sandbox.getInfo()
      if (sandboxInfo.status === 'paused') {
        timer.updateProgress(70, 'Resuming paused session')
        // Auto-resume by connecting (unified endpoint handles resume)
        // Note: Currently backend only preserves file system state after pause/resume.
        // Memory-level state (variables, imports, context) preservation is under development.
        // The existing context will be reused, but may not preserve all state.
        await session.sandbox.connect({
          timeoutMs: request.timeout || 600000
        })
        timer.updateProgress(80, 'Session resumed')
      }
      
      // 🔥 Automatic renewal: Delegate to Sandbox.setTimeout
      await this.autoRenewIfNeeded(session, request)
      
      timer.updateProgress(100, 'Session connected')
      return session
      
    } else {
      // Create new session
      timer.updateProgress(20, 'Creating new sandbox')
      
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: request.timeout || 600000,
        objectStorage: request.objectStorage
      })
      
      timer.updateProgress(60, 'Initializing code interpreter')
      
      const config = new ConnectionConfig({})
      const api = new ApiClient(config)
      const interpreter = new CodeInterpreter(sandbox, config, api)
      
      timer.updateProgress(80, 'Creating execution context')
      
      const context = await interpreter.createCodeContext({
        language: request.language || 'python',
        cwd: request.cwd || '/workspace'
      })
      
      const session: SessionState = {
        sandbox,
        interpreter,
        context,
        installedPackages: new Set(),
        uploadedFiles: new Set(),
        createdAt: new Date(),
        language: request.language || 'python'
      }
      
      // 🔥 sessionId = sandboxId (internal implementation)
      this.sessions.set(sandbox.sandboxId, session)
      
      timer.updateProgress(100, 'Sandbox created')
      return session
    }
  }
  
  /**
   * Automatic session renewal
   * 
   * Session layer logic: Check if renewal is needed
   * Sandbox layer execution: Delegate to sandbox.setTimeout()
   * 
   * Renewal threshold: 2 minutes (120000ms)
   */
  private static async autoRenewIfNeeded(
    session: SessionState,
    request: ExecutionRequest
  ): Promise<void> {
    try {
      // 🔥 Query from Sandbox (single source of truth)
      const sandboxInfo = await session.sandbox.getInfo()
      
      if (!sandboxInfo.endAt) {
        return  // No expiration, no renewal needed
      }
      
      // Session layer logic: Calculate remaining time
      const expiresAt = new Date(sandboxInfo.endAt)
      const remainingMs = expiresAt.getTime() - Date.now()
      const threshold = 120000  // 2 minutes
      
      if (remainingMs < threshold && remainingMs > 0) {
        // Session layer decision: Need renewal
        const timeout = request.timeout || 600000  // Default 10 minutes
        
        // 🔥 Delegate to Sandbox layer
        await session.sandbox.setTimeout(timeout)
        
        // Optional: Debug logging (no user interruption)
        if (process.env.SCALEBOX_DEBUG) {
          console.debug(
            `[Scalebox] Session ${session.sandbox.sandboxId} auto-renewed ` +
            `(${remainingMs}ms remaining -> +${timeout}ms)`
          )
        }
      }
    } catch (error) {
      // Renewal failure should not block execution
      console.warn(
        `[Scalebox] Auto-renewal failed for session ${session.sandbox.sandboxId}:`,
        error
      )
    }
  }
  
  /**
   * Smart file upload with deduplication
   * 
   * Only uploads files that haven't been uploaded in this session.
   */
  private static async smartUploadFiles(
    session: SessionState,
    files: Record<string, string | Buffer>,
    cwd: string,
    timer: ExecutionTimer
  ): Promise<void> {
    const entries = Object.entries(files)
    const totalFiles = entries.length
    let uploadedFiles = 0
    let skippedFiles = 0
    let bytesTransferred = 0
    
    for (const [path, content] of entries) {
      const size = typeof content === 'string' ? content.length : content.length
      
      if (!session.uploadedFiles.has(path)) {
        // New file, upload it
        timer.updateProgress(
          (uploadedFiles / totalFiles) * 100,
          `Uploading ${path} (${ExecutionTimer.formatBytes(size)})`,
          { filesUploaded: uploadedFiles, totalFiles, bytesTransferred }
        )
        
        // 🔥 Delegate to Sandbox layer
        // Convert Buffer to ArrayBuffer if needed
        const writeContent: string | ArrayBuffer = typeof content === 'string' 
          ? content 
          : content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer
        
        // Path resolution:
        // - Absolute paths (starting with /): used as-is
        // - Relative paths: resolved relative to cwd (default: /workspace)
        // Note: This ensures file paths align with code execution context
        const resolvedPath = path.startsWith('/') ? path : `${cwd}/${path}`.replace(/\/+/g, '/')
        await session.sandbox.files.write(resolvedPath, writeContent)
        session.uploadedFiles.add(path)  // Cache by original path for consistency
        bytesTransferred += size
      } else {
        // File already uploaded, skip
        skippedFiles++
      }
      
      uploadedFiles++
    }
    
    const message = skippedFiles > 0
      ? `Uploaded ${totalFiles - skippedFiles} files, skipped ${skippedFiles} (cached) - ${ExecutionTimer.formatBytes(bytesTransferred)}`
      : `Uploaded ${totalFiles} files (${ExecutionTimer.formatBytes(bytesTransferred)})`
    
    timer.updateProgress(100, message)
  }
  
  /**
   * Smart package installation with deduplication
   * 
   * Only installs packages that haven't been installed in this session.
   */
  private static async smartInstallPackages(
    session: SessionState,
    packages: string[],
    language: Language | undefined,
    timer: ExecutionTimer
  ): Promise<void> {
    const newPackages = packages.filter(pkg => !session.installedPackages.has(pkg))
    
    if (newPackages.length === 0) {
      // All packages already installed
      timer.updateProgress(
        100,
        `All ${packages.length} packages already installed (cached)`
      )
      return
    }
    
    timer.updateProgress(
      30,
      `Installing ${newPackages.length} packages: ${newPackages.join(', ')}`,
      { packagesInstalled: 0, totalPackages: newPackages.length }
    )
    
    const installCmd = this.getInstallCommand(
      language || session.language,
      newPackages
    )
    
    // Execute installation with output monitoring
    let installProgress = 30
    await session.interpreter.runCode(installCmd, {
      language: 'bash',
      context: session.context,
      onStdout: (output) => {
        // Update progress based on output
        // output is OutputMessage, extract content
        const content = output.content || ''
        installProgress = Math.min(90, installProgress + 5)
        timer.updateProgress(installProgress, `Installing: ${content.trim().slice(0, 50)}...`)
      }
    })
    
    // Mark packages as installed
    newPackages.forEach(pkg => session.installedPackages.add(pkg))
    
    const message = packages.length > newPackages.length
      ? `Installed ${newPackages.length} packages, ${packages.length - newPackages.length} already cached`
      : `Installed ${newPackages.length} packages`
    
    timer.updateProgress(100, message)
  }
  
  /**
   * Get install command for language
   */
  private static getInstallCommand(language: Language | string, packages: string[]): string {
    const lang = language.toLowerCase()
    
    // npm-based languages (JavaScript, Node.js, Deno, TypeScript)
    if (['javascript', 'node', 'nodejs', 'js', 'deno', 'typescript', 'ts'].includes(lang)) {
      return `npm install ${packages.join(' ')}`
    }
    
    // Python
    if (lang === 'python' || lang === 'python3') {
      return `pip install ${packages.join(' ')}`
    }
    
    // R
    if (lang === 'r') {
      return `R -e "install.packages(c(${packages.map(p => `'${p}'`).join(', ')}))"`
    }
    
    throw new ScaleboxError(`Unsupported language for package installation: ${language}`)
  }
  
  /**
   * Extend session timeout (manual renewal)
   * 
   * @param sessionId Session identifier
   * @param timeoutMs New timeout duration (default: 600000 = 10 minutes)
   * @returns Renewal information
   */
  static async keepAlive(
    sessionId: string,
    timeoutMs?: number
  ): Promise<SessionRenewalInfo> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new ScaleboxError(`Session ${sessionId} not found`)
    }
    
    const timeout = timeoutMs || 600000
    
    // 🔥 Delegate to Sandbox layer
    await session.sandbox.setTimeout(timeout)
    
    // 🔥 Query new expiration time from Sandbox
    const sandboxInfo = await session.sandbox.getInfo()
    const expiresAt = sandboxInfo.endAt
      ? new Date(sandboxInfo.endAt)
      : new Date(Date.now() + timeout)
    
    return {
      sessionId,
      newTimeout: timeout,
      expiresAt
    }
  }
  
  /**
   * Get detailed session information
   * 
   * Aggregates Session layer and Sandbox layer state.
   * 
   * @param sessionId Session identifier
   * @returns Complete session information
   */
  static async getSession(sessionId: string): Promise<SessionInfo> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new ScaleboxError(`Session ${sessionId} not found`)
    }
    
    // 🔥 Query real-time state from Sandbox
    const sandboxInfo = await session.sandbox.getInfo()
    const isRunning = await session.sandbox.isRunning()
    
    // Determine status: check sandboxInfo.status first, then fallback to isRunning
    // sandboxInfo.status can be 'running' | 'paused' | 'stopped' | etc.
    let status: 'running' | 'paused' | 'stopped'
    if (sandboxInfo.status === 'paused') {
      status = 'paused'
    } else if (isRunning) {
      status = 'running'
    } else {
      status = 'stopped'
    }
    
    const expiresAt = sandboxInfo.endAt ? new Date(sandboxInfo.endAt) : undefined
    const remainingTime = expiresAt ? expiresAt.getTime() - Date.now() : undefined
    
    return {
      sessionId,
      sandboxId: session.sandbox.sandboxId,
      language: session.language,
      
      // Session layer state
      installedPackages: Array.from(session.installedPackages),
      uploadedFiles: Array.from(session.uploadedFiles),
      createdAt: session.createdAt,
      
      // Sandbox layer state (real-time query)
      status,
      startedAt: sandboxInfo.startedAt
        ? new Date(sandboxInfo.startedAt)
        : session.createdAt,
      expiresAt,
      remainingTime,
      
      // Entry point to Sandbox layer
      sandbox: session.sandbox
    }
  }
  
  /**
   * List all active sessions
   * 
   * @returns List of session summaries
   */
  static async listSessions(): Promise<Array<{
    sessionId: string
    sandboxId: string
    language: string
    createdAt: Date
    expiresAt?: Date
  }>> {
    const results = []
    
    for (const [sessionId, session] of this.sessions) {
      try {
        const sandboxInfo = await session.sandbox.getInfo()
        results.push({
          sessionId,
          sandboxId: session.sandbox.sandboxId,
          language: session.language,
          createdAt: session.createdAt,
          expiresAt: sandboxInfo.endAt ? new Date(sandboxInfo.endAt) : undefined
        })
      } catch (error) {
        // Session may have expired, skip it
        this.sessions.delete(sessionId)
      }
    }
    
    return results
  }
  
  /**
   * Pause session to save resources
   * 
   * Delegates to Sandbox layer for pause operation.
   * 
   * @param sessionId Session identifier
   * @returns `true` if paused successfully, `false` if already paused
   */
  static async pause(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new ScaleboxError(`Session ${sessionId} not found`)
    }

    // 🔥 Delegate to Sandbox layer
    return await session.sandbox.betaPause()
  }
  
  /**
   * Close session and cleanup resources
   * 
   * @param sessionId Session identifier
   */
  static async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return  // Already closed or not found
    }
    
    try {
      await session.interpreter.close()
      // 🔥 Delegate to Sandbox layer
      await session.sandbox.kill()
    } finally {
      this.sessions.delete(sessionId)
    }
  }
  
  /**
   * Get session by ID (internal use)
   */
  static getSessionById(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId)
  }
}

