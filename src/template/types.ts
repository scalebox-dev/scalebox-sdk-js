/**
 * Template API types (camelCase for SDK; backend uses snake_case).
 * Aligned with back-end/internal/models/template.go and back-end/internal/api/templates.go.
 */

import type { ScaleboxListPagination } from '../api/pagination'

export type TemplateStatus = 'pending' | 'building' | 'pushing' | 'available' | 'failed'
export type TemplateVisibility = 'private' | 'account_shared' | 'public'
export type TemplateSource = 'scalebox_family' | 'custom'
export type CustomImageSource = 'external' | 'imported'

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** `GET /v1/import-jobs` status filter; `ongoing` matches pending or running jobs on the server. */
export type ImportJobListStatusFilter = ImportJobStatus | 'ongoing'

export interface TemplatePortConfig {
  port: number
  servicePort?: number
  protocol?: string
  name: string
  isProtected: boolean
}

export interface TemplateInfo {
  id?: number
  templateId: string
  name: string
  description?: string | null
  defaultCpuCount: number
  defaultMemoryMb: number
  visibility: TemplateVisibility
  templateSource: TemplateSource
  customImageSource?: CustomImageSource | null
  externalImageUrl?: string | null
  externalRegistryUsername?: string | null
  status: TemplateStatus
  ownerUserId?: string | null
  ownerAccountId?: string | null
  parentTemplateId?: string | null
  rootTemplateId?: string | null
  harborImageUrl?: string | null
  harborProject: string
  harborRepository: string
  harborTag: string
  imageSizeBytes?: number | null
  metadata?: string | Record<string, unknown> | null
  ports?: string | TemplatePortConfig[] | null
  defaultStorageClass?: string | null
  buildStartedAt?: string | null
  pushStartedAt?: string | null
  pushCompletedAt?: string | null
  buildErrorMessage?: string | null
  lastStorageSyncAt?: string | null
  createdAt: string
  updatedAt: string
  lastUpdatedAt?: string | null
  lastUpdatedBy?: string | null
  customCommand?: string | null
  readyCommand?: string | null
  owner?: { userId: string; username?: string; displayName?: string }
}

/**
 * Start command (custom_command) for custom templates must be JSON exec form:
 * {"Entrypoint": ["/path"], "Cmd": ["arg1", "arg2"]}. Plain text is rejected.
 * ready_command must be a JSON object with "type" (exec, httpGet, or tcpSocket):
 *   exec:      {"type": "exec", "command": "curl -sf http://localhost:80/ || exit 1"}
 *   httpGet:   {"type": "httpGet", "port": 80, "path": "/"}
 *   tcpSocket: {"type": "tcpSocket", "port": 6379}
 */
export interface CreateTemplateRequest {
  name: string
  description?: string
  defaultCpuCount?: number
  defaultMemoryMb?: number
  visibility?: TemplateVisibility
  templateSource?: TemplateSource
  customImageSource?: CustomImageSource
  externalImageUrl?: string
  externalRegistryUsername?: string
  externalRegistryPassword?: string
  harborImageUrl?: string
  harborProject?: string
  harborRepository?: string
  harborTag?: string
  metadata?: string
  baseTemplateId?: string
  ports?: string
  resetPorts?: boolean
  /** Custom templates: JSON string {"Entrypoint": string[], "Cmd": string[]}. Scalebox-family: plain text. */
  customCommand?: string
  /** Plain text readiness check (e.g. curl to a port). */
  readyCommand?: string
}

export interface UpdateTemplateRequest {
  name?: string
  description?: string
  defaultCpuCount?: number
  defaultMemoryMb?: number
  harborImageUrl?: string
  harborProject?: string
  harborRepository?: string
  harborTag?: string
  metadata?: string
  ports?: string
  customCommand?: string
  readyCommand?: string
}

export interface UpdateTemplateStatusRequest {
  status: TemplateStatus
  errorMessage?: string
  pushLogs?: string
  harborImageUrl?: string
}

export interface PrivateImageStorageUsage {
  usedGb: number
  limitGb: number
  percentage: number
}

export interface ValidateTemplateRequest {
  harborImageUrl: string
}

export interface ValidateTemplateResponse {
  message: string
  templateId: string
  buildStatus: string
  harborImageUrl?: string | null
}

export interface TemplateStatusUpdateResponse {
  message: string
  templateId: string
  buildStatus: string
}

export interface TemplateShareOperationResponse {
  templateId: string
  visibility: TemplateVisibility
  harborProject: string
  harborImageUrl?: string | null
  message: string
}

export interface ImportExistingTemplateResponse {
  jobId: string
  templateId: string
  status: string
  externalImageUrl?: string | null
  harborImageUrl?: string | null
  createdAt?: string
  message: string
}

/**
 * directImportTemplate: custom_command must be JSON {"Entrypoint": string[], "Cmd": string[]};
 * ready_command must be a JSON object (see CreateTemplateRequest for format).
 */
export interface DirectImportTemplateRequest {
  name: string
  description?: string
  externalImageUrl: string
  externalRegistryUsername?: string
  externalRegistryPassword?: string
  defaultCpuCount?: number
  defaultMemoryMb?: number
  visibility?: TemplateVisibility
  ports?: string
  /** JSON exec form: {"Entrypoint": string[], "Cmd": string[]}. */
  customCommand?: string
  /** Plain text (e.g. "curl -sf http://localhost:80/ || exit 1"). */
  readyCommand?: string
}

export interface ValidateCustomImageRequest {
  imageUrl: string
  username?: string
  password?: string
}

export interface ValidateCustomImageResponse {
  valid: boolean
  message?: string
  error?: string
  sizeBytes?: number
  sizeGb?: number
  cmd?: string[]
  entrypoint?: string[]
}

export interface ShareTemplateRequest {
  newName?: string
}

export interface TemplateListFilters {
  usable?: boolean
  status?: TemplateStatus
  visibility?: TemplateVisibility
  name?: string
  /** Partial match on name and description (backend `search` query). */
  search?: string
  /** 1-based page index (backend `page`). */
  page?: number
  /** Page size (backend `limit`). */
  limit?: number
  /** Alias for `limit` (backend `page_size`). */
  pageSize?: number
  /** Row offset (backend `offset`); takes precedence over `page` when both are sent. */
  offset?: number
  /** Alias for `offset` (backend `skip`). */
  skip?: number
}

export interface TemplateListResponse {
  templates: TemplateInfo[]
  /** Total row count; equal to `pagination.total`. */
  total: number
  pagination: ScaleboxListPagination
}

export interface TemplateChainItem {
  templateId: string
  name: string
  visibility: TemplateVisibility
}

export interface TemplateChainResponse {
  chain: TemplateChainItem[]
  depth: number
}

export interface ImportJobInfo {
  jobId: string
  templateId: string
  status: ImportJobStatus
  progressPercentage?: number
  externalImageUrl?: string
  harborImageUrl?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string
  updatedAt?: string
  lastLogMessage?: string
  errorMessage?: string
  skopeoLogs?: string
  retryCount?: number
  maxRetries?: number
}

export interface TemplateImportStatusResponse {
  jobId: string
  templateId: string
  status: ImportJobStatus
  progressPercentage?: number
  externalImageUrl?: string
  harborImageUrl?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string
  lastLogMessage?: string
  errorMessage?: string
  skopeoLogs?: string
}

export interface DirectImportTemplateResponse {
  templateId: string
  name: string
  visibility: TemplateVisibility
  jobId?: string
  status?: ImportJobStatus
  externalImageUrl?: string
  harborImageUrl?: string
  createdAt?: string
  message?: string
}

export interface ListImportJobsOpts {
  limit?: number
  offset?: number
  /** 1-based page index (backend `page`). */
  page?: number
  /** Alias for `offset` (backend `skip`). */
  skip?: number
  status?: ImportJobListStatusFilter
  templateId?: string
}

export interface ListImportJobsResponse {
  jobs: ImportJobInfo[]
  /** Total row count; equal to `pagination.total`. */
  total: number
  limit: number
  offset: number
  pagination: ScaleboxListPagination
}
