/**
 * Sandbox-related type definitions
 */

// Import necessary types from sandboxApi.ts
export type { SandboxOpts, SandboxApiOpts, SandboxListOpts, SandboxMetricsOpts } from './sandboxApi'

/**
 * Port configuration for sandbox
 */
export interface PortConfig {
  port: number
  servicePort?: number
  protocol?: 'TCP' | 'UDP'
  name: string
  isProtected?: boolean
}

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
  actualTotalPausedSeconds?: number
  totalRunningSeconds?: number
  actualTotalRunningSeconds?: number

  // Persistence (plan-based)
  persistenceDays?: number
  persistenceExpiresAt?: string | null
  persistenceDaysRemaining?: number | null

  // Auto-pause (IMMUTABLE, set at creation)
  autoPause?: boolean

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
  
  // Port configuration
  ports?: PortConfig[]
  templatePorts?: PortConfig[]
  customPorts?: PortConfig[]
  
  // Network proxy configuration (backend returns proxy_url + proxy_configs)
  netProxyCountry?: 'united-states' | 'canada' | 'japan' | 'malaysia' | 'brazil' | 'france' | 'italy' | 'china' | 'hong-kong'
  networkProxy?: {
    proxyUrl?: string
    proxyConfigs?: { host: string; port: number; username: string; password: string }
  } | null
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
  /**
   * Filter by sandbox status.
   * Note: Backend API accepts a single status string, but SDK accepts an array for convenience.
   * If multiple statuses are provided, only the first one will be used.
   */
  status?: Array<'created' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'terminating' | 'terminated' | 'failed'>
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

/**
 * Locality configuration for sandbox scheduling
 * 
 * Controls where the sandbox will be scheduled based on geographical preferences.
 * By default, locality is disabled and the system uses load-balanced scheduling.
 * 
 * @example
 * ```ts
 * // Auto-detect region from source IP
 * const sandbox = await Sandbox.create('base', {
 *   locality: {
 *     autoDetect: true
 *   }
 * })
 * 
 * // Specify a preferred region
 * const sandbox = await Sandbox.create('base', {
 *   locality: {
 *     region: 'us-east'
 *   }
 * })
 * 
 * // Force a specific region (will fail if region unavailable)
 * const sandbox = await Sandbox.create('base', {
 *   locality: {
 *     region: 'us-east',
 *     force: true
 *   }
 * })
 * ```
 */
export interface LocalityConfig {
  /**
   * Automatically detect the preferred region from the source IP address.
   * 
   * When enabled, the system will infer the region from your IP address using GeoIP.
   * If detection fails or the detected region is not available, the system will
   * fall back to default load-balanced scheduling (unless `force` is true).
   * 
   * @default false
   */
  autoDetect?: boolean

  /**
   * Explicitly specify a preferred Sandbox Region.
   * 
   * When provided, the system will prefer clusters in this region.
   * If no clusters are available in this region and `force` is false,
   * the system will fall back to other available clusters.
   * 
   * Use {@link SandboxApi.getScaleboxRegions} to get a list of available regions.
   * 
   * @example 'us-east', 'eu-west', 'ap-southeast'
   */
  region?: string

  /**
   * **Hard constraint**: fail if the requested region is not available.
   * 
   * When `force` is true and the specified region has no available clusters,
   * sandbox creation will fail with a conflict error (409) instead of falling back
   * to other regions.
   * 
   * **WARNING**: Use this option carefully. If the requested region is unavailable,
   * sandbox creation will fail even if other regions have capacity. This is a
   * hard constraint that prioritizes region preference over availability.
   * 
   * **Best practice**: Only use `force: true` when you have strict compliance
   * or regulatory requirements. For most use cases, use `force: false` (default)
   * to allow graceful fallback to other available regions.
   * 
   * @default false
   * @example
   * ```ts
   * // NOT RECOMMENDED: Hard constraint may cause failures
   * const sandbox = await Sandbox.create('base', {
   *   locality: {
   *     region: 'us-east',
   *     force: true  // Will fail if us-east is unavailable
   *   }
   * })
   * 
   * // RECOMMENDED: Best-effort with graceful fallback
   * const sandbox = await Sandbox.create('base', {
   *   locality: {
   *     region: 'us-east',
   *     force: false  // Falls back to other regions if us-east unavailable
   *   }
   * })
   * ```
   */
  force?: boolean
}

/**
 * Scalebox region information
 */
export interface ScaleboxRegion {
  /**
   * Region identifier (e.g., 'us-east', 'eu-west')
   */
  id: string

  /**
   * Human-readable region name (e.g., 'US East (N. Virginia)')
   */
  name: string
}

// Backward-compatible alias
export type SandboxRegion = ScaleboxRegion
