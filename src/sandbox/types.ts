/**
 * Sandbox 相关类型定义
 */

// 从 sandboxApi.ts 导入必要的类型
export type { SandboxOpts, SandboxApiOpts, SandboxListOpts, SandboxMetricsOpts } from './sandboxApi'

// 统一的沙箱信息结构
export interface SandboxInfo {
  // 基础字段
  sandboxId: string
  templateId: string
  name?: string
  metadata: Record<string, string>
  startedAt: Date
  endAt: Date
  status: 'running' | 'paused' | 'stopped' | 'starting' | 'stopping' | 'failed' | 'terminated' | 'created' | 'terminating'
  cpuCount: number
  memoryMB: number
  envdVersion: string
  envs?: Record<string, string>
  
  // Scalebox扩展字段（可选）
  templateName?: string
  sandboxDomain?: string
  timeout?: number
  uptime?: number
  
  // 生命周期管理字段
  substatus?: 'allocating' | 'deploying' | 'initializing' | 'waiting_ready' | 'cleaning_resources' | 'cleaning_data'
  reason?: string
  stoppedAt?: Date
  timeoutAt?: Date
  endedAt?: Date
  createdAt?: Date
  updatedAt?: Date
  
  // Kubernetes 部署信息
  clusterId?: string
  namespaceId?: string
  podName?: string
  podUid?: string
  podIp?: string
  nodeName?: string
  containerName?: string
  allocationTime?: Date
  lastPodStatus?: string
  
  // 状态管理信息
  deletionInProgress?: boolean
  
  // 访问令牌
  envdAccessToken?: string
  
  // 资源和成本信息
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
  
  // 所有者信息
  owner?: {
    userId: string
    username: string
    displayName?: string
    email: string
  }
  ownerUserId?: string
  projectId?: string
  projectName?: string
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
  status?: Array<'running' | 'paused' | 'stopped' | 'starting' | 'stopping'>
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
   * 使用签名过期时间（秒）
   */
  useSignatureExpiration?: number
  
  /**
   * 访问文件的用户
   */
  user?: string
}



export type SandboxState = 'running' | 'paused' | 'stopped' | 'starting' | 'stopping'

export interface SandboxBetaCreateOpts {
  /**
   * Automatically pause the sandbox after the timeout expires.
   * @default false
   */
  autoPause?: boolean
}
