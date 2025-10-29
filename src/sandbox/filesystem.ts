import { ConnectionConfig } from '../connectionConfig'
import { GrpcClient } from '../grpc/client'
import { Filesystem as FilesystemGrpc } from '../generated/api_pb.js'
import { 
  StatRequest, 
  StatResponse,
  MakeDirRequest,
  MakeDirResponse,
  MoveRequest,
  MoveResponse,
  ListDirRequest,
  ListDirResponse,
  RemoveRequest,
  RemoveResponse,
  EntryInfo as GrpcEntryInfo
} from '../generated/api_pb.js'

// Type declarations for Node.js modules
declare const require: (id: string) => any

/**
 * Sandbox filesystem object information.
 */
export interface WriteInfo {
  /**
   * Name of the filesystem object.
   */
  name: string
  /**
   * Type of the filesystem object.
   */
  type?: FileType
  /**
   * Path to the filesystem object.
   */
  path: string
}

export interface EntryInfo extends WriteInfo {
  /**
   * Size of the filesystem object in bytes.
   */
  size: number
  /**
   * Last modified time of the filesystem object.
   */
  modifiedAt: Date
  /**
   * Permissions of the filesystem object.
   */
  mode: number
  /**
   * File permissions string (e.g., 'rwxr-xr-x').
   */
  permissions?: string
  /**
   * Owner of the filesystem object.
   */
  owner?: string
  /**
   * Group owner of the filesystem object.
   */
  group?: string
  /**
   * Target of the symlink if the filesystem object is a symlink.
   */
  symlinkTarget?: string
}

export type FileType = 'file' | 'directory' | 'symlink'

export interface FilesystemRequestOpts {
  /**
   * User to perform the operation as.
   */
  user?: string
  /**
   * Request timeout in milliseconds.
   */
  requestTimeoutMs?: number
}

export interface ReadOpts extends FilesystemRequestOpts {
  /**
   * Format of the file content.
   */
  format?: 'text' | 'bytes' | 'blob' | 'stream'
}

export interface WriteOpts extends FilesystemRequestOpts {
  /**
   * Whether to create parent directories if they don't exist.
   */
  createDirs?: boolean
}

export interface ListOpts extends FilesystemRequestOpts {
  /**
   * Whether to list recursively.
   */
  recursive?: boolean
}

export interface MoveOpts extends FilesystemRequestOpts {
  /**
   * Whether to overwrite existing files.
   */
  overwrite?: boolean
}

export interface RemoveOpts extends FilesystemRequestOpts {
  /**
   * Whether to remove recursively.
   */
  recursive?: boolean
}

export interface StatOpts extends FilesystemRequestOpts {}

export interface WatchOpts extends FilesystemRequestOpts {
  /**
   * Whether to watch recursively.
   */
  recursive?: boolean
}

export interface WatcherOpts extends FilesystemRequestOpts {
  /**
   * Whether to watch recursively.
   */
  recursive?: boolean
}

export interface FileWatchEvent {
  /**
   * Event type
   */
  type: 'create' | 'write' | 'remove' | 'rename' | 'chmod'
  /**
   * File name relative to watched directory
   */
  name: string
  /**
   * Full path to the file
   */
  path?: string
}

export interface FileWatcher {
  /**
   * Watcher ID
   */
  id: string
  /**
   * Get events since last call
   */
  getEvents(): Promise<FileWatchEvent[]>
  /**
   * Remove the watcher
   */
  remove(): Promise<void>
}

/**
 * Module for interacting with the sandbox filesystem.
 * Uses hybrid approach: HTTP for file content, gRPC for metadata operations
 */
export class Filesystem {
  private readonly connectionConfig: ConnectionConfig
  private readonly sandboxId: string
  private readonly sandboxDomain: string
  private readonly envdAccessToken: string
  private readonly grpcClient: GrpcClient
  private readonly filesystemGrpc: any

  constructor(
    sandboxId: string,
    connectionConfig: ConnectionConfig,
    sandboxDomain: string,
    envdAccessToken: string,
    grpcClient?: GrpcClient
  ) {
    this.sandboxId = sandboxId
    this.sandboxDomain = sandboxDomain
    this.envdAccessToken = envdAccessToken
    this.connectionConfig = connectionConfig
    
    // Pass sandboxDomain and envdAccessToken to GrpcClient
    // sandboxDomain will be used as the gRPC endpoint for all gRPC operations
    this.grpcClient = grpcClient || new GrpcClient(connectionConfig, sandboxDomain, envdAccessToken)
    this.filesystemGrpc = this.grpcClient.filesystem
  }

  /**
   * Get authentication headers for HTTP requests
   * For gRPC requests, authentication is handled by the GrpcClient interceptor
   */
  private getAuthHeaders(user: string = 'root'): Record<string, string> {
    const headers: Record<string, string> = {}
    
    // Use correct authentication format for sandboxagent HTTP API
    headers['Authorization'] = `Bearer ${user}`
    
    // X-Access-Token MUST be the envdAccessToken from sandbox creation
    headers['X-Access-Token'] = this.envdAccessToken
    
    return headers
  }
  
  /**
   * Get headers for gRPC requests
   * gRPC authentication is handled by GrpcClient interceptor, so we don't set Authorization here
   * Only set additional headers if needed (like X-User for impersonation)
   */
  private getGrpcHeaders(user?: string): Record<string, string> {
    const headers: Record<string, string> = {}
    
    // If a specific user is requested for impersonation, pass it
    if (user && user !== 'root') {
      headers['X-User'] = user
    }
    
    return headers
  }

  /**
   * Get HTTP API base URL for file operations
   * Uses sandboxDomain which already includes the correct port (8888)
   */
  private getHttpApiUrl(): string {
    // sandboxDomain already includes the correct port, so we don't need to specify it
    const domain = this.sandboxDomain
    return `https://${domain}`
  }

  /**
   * Handle HTTP API errors consistently
   */
  private async handleHttpError(response: Response, operation: string): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    
    try {
      const errorData = await response.json()
      if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Ignore JSON parsing errors
    }
    
    throw new Error(`Failed to ${operation}: ${errorMessage}`)
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

  /**
   * Read file content as a `string`.
   *
   * You can pass `text`, `bytes`, `blob`, or `stream` to `opts.format` to change the return type.
   *
   * @param path path to the file.
   * @param opts connection options.
   * @param [opts.format] format of the file content—`text` by default.
   *
   * @returns file content as string
   */
  async read(
    path: string,
    opts?: ReadOpts
  ): Promise<string> {
    try {
      const user = opts?.user
      const format = opts?.format || 'text'
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      const response = await fetch(
        `${this.getHttpApiUrl()}/download/${path.replace(/^\/+/, '')}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(user),
          signal: this.connectionConfig.getSignal(timeoutMs)
        }
      )
      
      if (!response.ok) {
        await this.handleHttpError(response, `read file ${path}`)
      }
      
      if (format === 'text') {
        return await response.text()
      } else if (format === 'bytes') {
        const buffer = await response.arrayBuffer()
        return Buffer.from(buffer).toString('base64')
      } else if (format === 'blob') {
        const blob = await response.blob()
        return URL.createObjectURL(blob)
      } else if (format === 'stream') {
        // For stream format, return the response body as a readable stream
        return response.body as any
      }
      
      return await response.text()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to read file ${path}: ${error}`)
    }
  }

  /**
   * Write content to a file.
   *
   * Writing to a file that doesn't exist creates the file.
   * Writing to a file that already exists overwrites the file.
   * Writing to a file at path that doesn't exist creates the necessary directories.
   *
   * @param path path to file.
   * @param data data to write to the file. Data can be a string, `ArrayBuffer`, `Blob`, or `ReadableStream`.
   * @param opts connection options.
   *
   * @returns information about the written file
   */
  async write(
    path: string,
    data: string | ArrayBuffer | Blob | ReadableStream,
    opts?: WriteOpts
  ): Promise<WriteInfo> {
    try {
      const user = opts?.user
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      const formData = new FormData()
      let blob: Blob
      
      if (typeof data === 'string') {
        blob = new Blob([data])
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data])
      } else if (data instanceof ReadableStream) {
        // Use native Response API for efficient stream to blob conversion
        blob = await new Response(data).blob()
      } else {
        blob = data as Blob
      }
      
      // Match Python SDK format: files parameter for file data, data parameter for path
      formData.append('file', blob, path)
      formData.append('path', path)
      
      const requestUrl = `${this.getHttpApiUrl()}/upload`
      const requestHeaders = this.getAuthHeaders(user)
      
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
        signal: this.connectionConfig.getSignal(timeoutMs)
      })
      
      
      if (!response.ok) {
        await this.handleHttpError(response, `write file ${path}`)
      }
      
      // Handle different response formats
      const contentType = response.headers.get('content-type')
      let result: any
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // Handle plain text response (e.g., "uploaded: /path/to/file")
        await response.text()
        
        // Create a mock result for plain text responses
        result = {
          name: path.split('/').pop() || path,
          type: 'file',
          path: path
        }
      }
      
      return {
        name: result.name || path.split('/').pop() || path,
        type: (result.type || 'file') as FileType,
        path: result.path || path
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to write file ${path}: ${error}`)
    }
  }

  /**
   * List files and directories in a directory.
   *
   * @param path path to the directory.
   * @param opts connection options.
   *
   * @returns list of files and directories
   */
  async list(
    path: string,
    opts?: ListOpts
  ): Promise<EntryInfo[]> {
    try {
      const user = opts?.user || 'root'
      const depth = opts?.recursive ? 999 : 1
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      // Use gRPC for metadata operations via Connect-RPC
      const request = {
        path: path,
        depth: depth
      }
      
      if (this.connectionConfig.debug) {
      }
      
      const response = await this.filesystemGrpc.listDir(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })
      
      const entries = response.entries.map((entry: any) => ({
        name: entry.name,
        type: this.mapFileType(entry.type),
        path: entry.path,
        size: entry.size,
        modifiedAt: new Date(entry.modifiedTime?.seconds ? Number(entry.modifiedTime.seconds) * 1000 : Date.now()),
        mode: entry.mode,
        permissions: entry.permissions,
        owner: entry.owner,
        group: entry.group,
        symlinkTarget: entry.symlinkTarget
      }))
      
      if (this.connectionConfig.debug) {
        console.log(`📂 Listed ${entries.length} entries from ${path}`)
      }
      
      return entries
    } catch (error) {
      this.handleGrpcError(error, `list directory ${path}`)
    }
  }

  /**
   * Map gRPC file type to our FileType
   */
  private mapFileType(grpcType: number): FileType {
    switch (grpcType) {
      case 1: // FILE_TYPE_FILE
        return 'file'
      case 2: // FILE_TYPE_DIRECTORY
        return 'directory'
      default:
        return 'file'
    }
  }

  /**
   * Create a directory.
   *
   * @param path path to the directory.
   * @param opts connection options.
   *
   * @returns information about the created directory
   */
  async makeDir(
    path: string,
    opts?: FilesystemRequestOpts
  ): Promise<WriteInfo> {
    try {
      const user = opts?.user
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      // Use gRPC for metadata operations
      const request = {
        path: path
      }
      
      const response = await this.filesystemGrpc.makeDir(request, {
        headers: this.getGrpcHeaders(user),
        signal: this.connectionConfig.getSignal(timeoutMs)
      })
      
      return {
        name: response.entry.name,
        type: this.mapFileType(response.entry.type),
        path: response.entry.path
      }
    } catch (error) {
      this.handleGrpcError(error, `create directory ${path}`)
    }
  }

  /**
   * Move or rename a file or directory.
   *
   * @param src source path.
   * @param dest destination path.
   * @param opts connection options.
   *
   * @returns information about the moved file or directory
   */
  async move(
    src: string,
    dest: string,
    opts?: MoveOpts
  ): Promise<WriteInfo> {
    try {
      const user = opts?.user
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      // Use gRPC for metadata operations
      const request = {
        source: src,
        destination: dest
      }
      
      const response = await this.filesystemGrpc.move(request, {
        headers: this.getGrpcHeaders(user),
        signal: this.connectionConfig.getSignal(timeoutMs)
      })
      
      return {
        name: response.entry.name,
        type: this.mapFileType(response.entry.type),
        path: response.entry.path
      }
    } catch (error) {
      this.handleGrpcError(error, `move ${src} to ${dest}`)
    }
  }

  /**
   * Remove a file or directory.
   *
   * @param path path to the file or directory.
   * @param opts connection options.
   */
  async remove(
    path: string,
    opts?: RemoveOpts
  ): Promise<void> {
    try {
      const user = opts?.user
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      // Use gRPC for metadata operations
      const request = {
        path: path
      }
      
      await this.filesystemGrpc.remove(request, {
        headers: this.getGrpcHeaders(user),
        signal: this.connectionConfig.getSignal(timeoutMs)
      })
    } catch (error) {
      this.handleGrpcError(error, `remove ${path}`)
    }
  }

  /**
   * Get information about a file or directory.
   *
   * @param path path to the file or directory.
   * @param opts connection options.
   *
   * @returns information about the file or directory
   */
  async stat(
    path: string,
    opts?: StatOpts
  ): Promise<EntryInfo> {
    try {
      const user = opts?.user
      const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs
      
      // Use gRPC for metadata operations
      const request = {
        path: path
      }
      
      
      // gRPC client handles authentication via interceptor, no need to pass headers here
      const response = await this.filesystemGrpc.stat(request)
      
      
      return {
        name: response.entry.name,
        type: this.mapFileType(response.entry.type),
        path: response.entry.path,
        size: response.entry.size,
        modifiedAt: new Date(response.entry.modifiedTime?.seconds ? Number(response.entry.modifiedTime.seconds) * 1000 : Date.now()),
        mode: response.entry.mode,
        permissions: response.entry.permissions,
        owner: response.entry.owner,
        group: response.entry.group,
        symlinkTarget: response.entry.symlinkTarget
      }
    } catch (error) {
      this.handleGrpcError(error, `get file info for ${path}`)
    }
  }

  /**
   * Check if a file or directory exists.
   *
   * @param path path to the file or directory.
   * @param opts connection options.
   *
   * @returns true if the file or directory exists, false otherwise
   */
  async exists(
    path: string,
    opts?: StatOpts
  ): Promise<boolean> {
    try {
      await this.stat(path, opts)
      return true
    } catch (error) {
      // If stat fails with not found error, the file doesn't exist
      if (error instanceof Error && error.message.includes('not found')) {
        return false
      }
      // Re-throw other errors
      throw error
    }
  }

  /**
   * Upload a file from local filesystem to sandbox.
   * This is a convenience method that combines file reading and writing.
   *
   * @param localPath path to the local file to upload.
   * @param remotePath path in the sandbox where the file should be uploaded.
   * @param opts connection options.
   *
   * @returns information about the uploaded file
   */
  async uploadFile(
    localPath: string,
    remotePath: string,
    opts?: WriteOpts
  ): Promise<WriteInfo> {
    try {
      // For browser environments, this method would need to be adapted
      // to work with File objects instead of file paths
      if (typeof window !== 'undefined') {
        throw new Error('uploadFile method is not supported in browser environments. Use write() method with File/Blob objects instead.')
      }

      // Use require for Node.js environments to avoid dynamic import issues
      const fs = require('fs')
      const fileData = fs.readFileSync(localPath)
      
      // Convert Buffer to ArrayBuffer for compatibility
      const arrayBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      )
      
      return await this.write(remotePath, arrayBuffer, opts)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to upload file from ${localPath} to ${remotePath}: ${error}`)
    }
  }

  /**
   * Download a file from sandbox to local filesystem.
   * This is a convenience method that combines file reading and writing.
   *
   * @param remotePath path to the file in the sandbox.
   * @param localPath path where the file should be saved locally.
   * @param opts connection options.
   *
   * @returns information about the downloaded file
   */
  async downloadFile(
    remotePath: string,
    localPath: string,
    opts?: ReadOpts
  ): Promise<{ name: string; path: string; size: number }> {
    try {
      // For browser environments, this method would need to be adapted
      // to return the file content instead of saving to filesystem
      if (typeof window !== 'undefined') {
        throw new Error('downloadFile method is not supported in browser environments. Use read() method instead.')
      }

      const content = await this.read(remotePath, { ...opts, format: 'bytes' })
      
      // Use require for Node.js environments to avoid dynamic import issues
      const fs = require('fs')
      const path = require('path')
      
      // Ensure directory exists
      const dir = path.dirname(localPath)
      fs.mkdirSync(dir, { recursive: true })
      
      // Convert base64 content back to buffer if needed
      let buffer: Buffer
      if (typeof content === 'string') {
        buffer = Buffer.from(content, 'base64')
      } else {
        buffer = Buffer.from(content)
      }
      
      fs.writeFileSync(localPath, buffer)
      
      return {
        name: path.basename(localPath),
        path: localPath,
        size: buffer.length
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to download file from ${remotePath} to ${localPath}: ${error}`)
    }
  }

  /**
   * Watch a directory for file system changes.
   * Returns a stream of file system events.
   * 
   * @param path path to the directory to watch.
   * @param opts watch options.
   * 
   * @returns async generator of file watch events
   */
  async *watchDir(
    path: string,
    opts?: WatchOpts
  ): AsyncGenerator<FileWatchEvent, void, unknown> {
    const user = opts?.user || 'root'
    const recursive = opts?.recursive || false
    const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

    if (this.connectionConfig.debug) {
      console.log('👀 Starting directory watch via gRPC stream:', { path, recursive, user })
    }

    try {
      const request = {
        path: path,
        recursive: recursive
      }

      // Use gRPC streaming for real-time file system events
      const stream = this.filesystemGrpc.watchDir(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      for await (const response of stream) {
        if (response.event?.case === 'filesystem') {
          const fsEvent = response.event.value
          const eventType = this.mapEventType(fsEvent.type)
          
          if (eventType) {
            const event: FileWatchEvent = {
              type: eventType,
              name: fsEvent.name,
              path: `${path}/${fsEvent.name}`
            }
            
            if (this.connectionConfig.debug) {
              console.log('👀 File system event:', event)
            }
            
            yield event
          }
        } else if (response.event?.case === 'start') {
          if (this.connectionConfig.debug) {
            console.log('👀 Directory watch started for:', path)
          }
        } else if (response.event?.case === 'keepalive') {
          if (this.connectionConfig.debug) {
            console.log('👀 Directory watch keepalive for:', path)
          }
        }
      }
    } catch (error) {
      if (this.connectionConfig.debug) {
        console.error('👀 Directory watch error:', error)
      }
      this.handleGrpcError(error, `watch directory ${path}`)
    }
  }

  /**
   * Create a file watcher for polling-based file system monitoring.
   * This is useful when you need to check for changes periodically rather than streaming.
   * 
   * @param path path to the directory to watch.
   * @param opts watcher options.
   * 
   * @returns file watcher instance
   */
  async createWatcher(
    path: string,
    opts?: WatcherOpts
  ): Promise<FileWatcher> {
    const user = opts?.user || 'root'
    const recursive = opts?.recursive || false
    const timeoutMs = opts?.requestTimeoutMs || this.connectionConfig.requestTimeoutMs

    if (this.connectionConfig.debug) {
      console.log('📝 Creating file watcher via gRPC:', { path, recursive, user })
    }

    try {
      const request = {
        path: path,
        recursive: recursive
      }

      const response = await this.filesystemGrpc.createWatcher(request, {
        signal: this.connectionConfig.getSignal(timeoutMs)
      })

      const watcherId = response.watcherId

      if (this.connectionConfig.debug) {
        console.log('📝 Created file watcher:', watcherId)
      }

      // Return watcher instance
      return {
        id: watcherId,
        getEvents: async (): Promise<FileWatchEvent[]> => {
          try {
            const eventsResponse = await this.filesystemGrpc.getWatcherEvents({
              watcherId: watcherId
            }, {
              signal: this.connectionConfig.getSignal(timeoutMs)
            })

            return eventsResponse.events.map((event: any) => ({
              type: this.mapEventType(event.type) || 'write',
              name: event.name,
              path: `${path}/${event.name}`
            }))
          } catch (error) {
            this.handleGrpcError(error, `get watcher events for ${watcherId}`)
          }
        },
        remove: async (): Promise<void> => {
          try {
            await this.filesystemGrpc.removeWatcher({
              watcherId: watcherId
            }, {
              signal: this.connectionConfig.getSignal(timeoutMs)
            })

            if (this.connectionConfig.debug) {
              console.log('📝 Removed file watcher:', watcherId)
            }
          } catch (error) {
            this.handleGrpcError(error, `remove watcher ${watcherId}`)
          }
        }
      }
    } catch (error) {
      this.handleGrpcError(error, `create watcher for ${path}`)
    }
  }

  /**
   * Map gRPC event type to our event type
   */
  private mapEventType(grpcEventType: number): FileWatchEvent['type'] | null {
    switch (grpcEventType) {
      case 1: // EVENT_TYPE_CREATE
        return 'create'
      case 2: // EVENT_TYPE_WRITE
        return 'write'
      case 3: // EVENT_TYPE_REMOVE
        return 'remove'
      case 4: // EVENT_TYPE_RENAME
        return 'rename'
      case 5: // EVENT_TYPE_CHMOD
        return 'chmod'
      default:
        return null
    }
  }
}
