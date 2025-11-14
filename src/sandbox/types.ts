/**
 * Sandbox-related type definitions
 */

// Import necessary types from sandboxApi.ts
export type { SandboxOpts, SandboxApiOpts, SandboxListOpts, SandboxMetricsOpts } from './sandboxApi'

// Unified sandbox information structure
export interface SandboxInfo {
  // Basic fields
  sandboxId: string
  templateId: string
  name?: string
  metadata: Record<string, string>
  startedAt: Date
  endAt: Date
  status: 'running' | 'paused' | 'pausing' | 'resuming' | 'stopped' | 'starting' | 'stopping' | 'failed' | 'terminated' | 'created' | 'terminating'
  cpuCount: number
  memoryMB: number
  envdVersion: string
  envs?: Record<string, string>
  
  // Scalebox extended fields (optional)
  templateName?: string
  sandboxDomain?: string
  timeout?: number
  uptime?: number
  
  // Lifecycle management fields
  substatus?: 'allocating' | 'deploying' | 'initializing' | 'waiting_ready' | 'cleaning_resources' | 'cleaning_data'
  reason?: string
  stoppedAt?: Date
  timeoutAt?: Date
  endedAt?: Date
  createdAt?: Date
  updatedAt?: Date
  
  // Pause/Resume tracking fields
  pausedAt?: Date
  resumedAt?: Date
  pauseTimeoutAt?: Date
  totalPausedSeconds?: number
  
  // Kubernetes deployment information
  clusterId?: string
  namespaceId?: string
  podName?: string
  podUid?: string
  podIp?: string
  nodeName?: string
  containerName?: string
  allocationTime?: Date
  lastPodStatus?: string
  
  // State management information
  deletionInProgress?: boolean
  
  // Access token
  envdAccessToken?: string
  
  // Resource and cost information
  resources?: {
    cpu: number
    memory: number
    storage: number
    bandwidth: number
  }
  cost?: {
    hourlyRate: number
    totalCost: number
  }
  
  // Owner information
  owner?: {
    userId: string
    username: string
    displayName?: string
    email: string
  }
  ownerUserId?: string
  projectId?: string
  projectName?: string
  
  // Object storage mount information
  objectStorage?: ObjectStorageInfo
}

export interface SandboxMetrics {
  timestamp: Date
  cpuUsedPct: number
  cpuCount: number
  memUsed: number
  memTotal: number
  diskUsed: number
  diskTotal: number
}

export interface SandboxQuery {
  metadata?: Record<string, string>
  status?: Array<'running' | 'paused' | 'pausing' | 'resuming' | 'stopped' | 'starting' | 'stopping'>
  templateId?: string
}


export interface SandboxConnectOpts {
  sandboxId?: string
  apiKey?: string
  apiUrl?: string
  requestTimeoutMs?: number
  timeoutMs?: number
  debug?: boolean
  domain?: string
  headers?: Record<string, string>
  envs?: Record<string, string>
}

export interface SandboxUrlOpts {
  /**
   * Signature expiration time in seconds
   */
  useSignatureExpiration?: number
  
  /**
   * User to access the file as
   */
  user?: string
}

/**
 * Object storage configuration for mounting S3-compatible storage
 */
export interface ObjectStorageConfig {
  /**
   * S3 URI (e.g., "s3://bucket-name/path/prefix/")
   */
  uri: string
  
  /**
   * Mount point path in the sandbox (e.g., "/mnt/oss")
   */
  mountPoint: string
  
  /**
   * S3 access key
   */
  accessKey: string
  
  /**
   * S3 secret key
   */
  secretKey: string
  
  /**
   * AWS region (e.g., "ap-east-1")
   */
  region: string
  
  /**
   * S3 endpoint URL (e.g., "https://s3.ap-east-1.amazonaws.com")
   */
  endpoint: string
}

/**
 * Object storage information returned from API
 * (credentials are not returned for security)
 */
export interface ObjectStorageInfo {
  /**
   * S3 URI
   */
  uri: string
  
  /**
   * Mount point path
   */
  mountPoint: string
}



export type SandboxState = 'running' | 'paused' | 'pausing' | 'resuming' | 'stopped' | 'starting' | 'stopping'

export interface SandboxBetaCreateOpts {
  /**
   * Automatically pause the sandbox after the timeout expires.
   * @default false
   */
  autoPause?: boolean
}
