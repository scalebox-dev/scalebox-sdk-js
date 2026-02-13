/**
 * Template API types (camelCase for SDK; backend uses snake_case).
 * Aligned with back-end/internal/models/template.go and back-end/internal/api/templates.go.
 */

export type TemplateStatus = 'pending' | 'building' | 'pushing' | 'available' | 'failed'
export type TemplateVisibility = 'private' | 'account_shared' | 'public'
export type TemplateSource = 'scalebox_family' | 'custom'
export type CustomImageSource = 'external' | 'imported'

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

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
 * ready_command is plain text (e.g. "curl -sf http://localhost:80/ || exit 1").
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

/**
 * directImportTemplate: custom_command must be JSON {"Entrypoint": string[], "Cmd": string[]};
 * ready_command is plain text.
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
}

export interface TemplateListResponse {
  templates: TemplateInfo[]
  total: number
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
  errorMessage?: string
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
  status?: ImportJobStatus
  templateId?: string
}

export interface ListImportJobsResponse {
  jobs: ImportJobInfo[]
  total: number
  limit: number
  offset: number
}
