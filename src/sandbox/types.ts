/**
 * Sandbox-related type definitions
 */

import type { ScaleboxListPagination } from '../api/pagination'

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
  objectStorage?: ObjectStorageInfo    // backward compat: first mount only
  objectStorages?: ObjectStorageInfo[] // all mounts (multi-path support)
  
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

/** Options for {@link ApiClient.listSandboxes} (offset / page aligned with backend listparams). */
export interface ListSandboxesOpts {
  query?: SandboxQuery
  limit?: number
  /** Alias for `limit` (query `page_size`). */
  pageSize?: number
  /** 1-based page index (query `page`). */
  page?: number
  /** Row offset (query `offset`). When set with `page`, backend prefers offset. */
  offset?: number
  /** Alias for `offset` (query `skip`). */
  skip?: number
  /**
   * @deprecated Not used by the backend. Prefer `page` / `offset` and `pagination` on the result.
   */
  nextToken?: string
}

export interface ListSandboxesResult {
  sandboxes: SandboxInfo[]
  pagination: ScaleboxListPagination
  /**
   * @deprecated Always undefined; use `pagination` for paging.
   */
  nextToken?: string
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
 * Object storage configuration for mounting S3-compatible storage.
 *
 * At least one of `region` or `endpoint` must be provided.
 */
export interface ObjectStorageConfig {
  /**
   * Object storage URI. Supported schemes: `s3://`, `oss://`, `cos://`.
   *
   * @example 's3://my-bucket/data/prefix/'
   */
  uri: string

  /**
   * Absolute mount path inside the sandbox. Must start with `/`.
   *
   * @example '/mnt/oss'
   */
  mountPoint: string

  /**
   * S3-compatible access key (required, never stored in backend DB).
   */
  accessKey: string

  /**
   * S3-compatible secret key (required, never stored in backend DB).
   */
  secretKey: string

  /**
   * Storage region (e.g., `"ap-east-1"`).
   * At least one of `region` or `endpoint` must be provided.
   */
  region?: string

  /**
   * S3-compatible endpoint URL (e.g., `"https://s3.ap-east-1.amazonaws.com"`).
   * At least one of `region` or `endpoint` must be provided.
   */
  endpoint?: string
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
 * **Priority rules:**
 * - `region` takes precedence over `autoDetect`. If both are set, `autoDetect` is ignored.
 * - `force` only applies when `region` is explicitly set. It is ignored for `autoDetect` mode.
 * - An empty locality object (all defaults) is valid and means "disabled" (default scheduling).
 *
 * @example
 * ```ts
 * // Auto-detect region from source IP (best-effort, silent fallback)
 * const sandbox = await Sandbox.create('base', {
 *   locality: {
 *     autoDetect: true
 *   }
 * })
 *
 * // Specify a preferred region (soft constraint, falls back if unavailable)
 * const sandbox = await Sandbox.create('base', {
 *   locality: {
 *     region: 'us-east'
 *   }
 * })
 *
 * // Force a specific region (hard constraint, 409 if unavailable)
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
   * This is best-effort: if detection fails or the detected region is not available,
   * the system silently falls back to default load-balanced scheduling.
   *
   * **Note:** If `region` is also set, `autoDetect` is ignored (region takes precedence).
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
   * **Note:** Takes precedence over `autoDetect`. If both are set, `autoDetect` is ignored.
   *
   * Use {@link SandboxApi.getScaleboxRegions} to get a list of available regions.
   *
   * @example 'us-east', 'eu-west', 'ap-southeast'
   */
  region?: string

  /**
   * **Hard constraint**: fail if the requested region is not available.
   *
   * Only applies when `region` is explicitly set. Ignored for `autoDetect` mode.
   *
   * When `force` is true and the specified region has no available clusters,
   * sandbox creation will fail with a conflict error (409) instead of falling back
   * to other regions.
   *
   * **Best practice**: Only use `force: true` when you have strict compliance
   * or regulatory requirements. For most use cases, use `force: false` (default)
   * to allow graceful fallback to other available regions.
   *
   * @default false
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
