/**
 * Scalebox SDK for JavaScript/TypeScript
 * A powerful SDK for running code in sandboxed environments
 */

// Core exports
export { Sandbox } from './sandbox'
export { SandboxApi } from './sandbox/sandboxApi'
export { SandboxPaginator } from './sandbox'
export { Filesystem } from './sandbox/filesystem'
export { Commands } from './sandbox/commands'
export { Pty } from './sandbox/pty'
export { ProcessManager } from './sandbox/process'
export { CodeInterpreter } from './code-interpreter/index'
export { Desktop } from './desktop'

// High-Level Session API
export { Session, SessionExecutor, ExecutionTimer } from './session'


// Desktop type exports
export type {
  DesktopOpts,
  DesktopAutomation,
  CursorPosition,
  ScreenSize,
  WindowInfo,
  MouseButtonType,
  VNCServer,
  VNCServerStatus,
  VNCServerStartOptions,
  VNCConnectionUrlOptions,
  VNCResizeMode,
  DesktopStream
} from './desktop/types'

// gRPC API exports
export { createGrpcClient, GrpcClient } from './grpc/client'
export { createScaleboxApi, type ScaleboxGrpcApi } from './grpc/api'
export {
  Code,
  ConnectError,
  getGrpcErrorMessage,
  isGrpcAuthError,
  isGrpcCancellationError,
  isGrpcInvalidArgumentError,
  isGrpcNotFoundError,
  isGrpcPermissionError,
  isGrpcResourceExhaustedError,
  isGrpcRetryableError,
  isGrpcTimeoutError
} from './grpc/errors'

// HTTP API exports
export { ApiClient } from './api'

// Type exports
export type { 
  SandboxOpts, 
  SandboxInfo, 
  SandboxMetrics,
  SandboxListOpts,
  SandboxConnectOpts,
  SandboxQuery,
  SandboxUrlOpts,
  SandboxMetricsOpts,
  SandboxApiOpts,
  SandboxState,
  SandboxBetaCreateOpts,
  PortConfig,
  LocalityConfig,
  ScaleboxRegion,
  SandboxRegion
} from './sandbox/types'

// Export filesystem types
export type {
  WriteInfo,
  EntryInfo,
  FileType,
  FilesystemRequestOpts,
  ReadOpts,
  WriteOpts,
  ListOpts,
  MoveOpts,
  RemoveOpts,
  StatOpts,
  WatchOpts,
  WatcherOpts,
  FileWatchEvent,
  FileWatcher
} from './sandbox/filesystem'

// Export process types
export type {
  ProcessConfig,
  PTYConfig,
  ProcessInfo,
  ProcessSelector,
  ProcessEvent,
  ProcessRequestOpts,
  ProcessStartOpts,
  ProcessConnectOpts,
  ProcessSignal
} from './sandbox/process'

// Export command types
export type {
  CommandRequestOpts,
  CommandStartOpts,
  CommandConnectOpts,
  CommandResult
} from './sandbox/commands'

// Export pty types
export type {
  PtyRequestOpts,
  PtyStartOpts,
  PtyConnectOpts
} from './sandbox/pty'
export type {
  CodeInterpreterOpts,
  CodeContext,
  ExecutionResult,
  OutputMessage,
  Result,
  ExecutionError,
  Language,
  CodeExecutionOpts
} from './code-interpreter/types'
export type { ConnectionConfigOpts } from './connectionConfig'

// High-Level Session API type exports
export type {
  ExecutionRequest,
  ExecutionResponse,
  ExecutionStage,
  ExecutionTiming,
  ExecutionInsights,
  ProgressInfo,
  SessionInfo,
  SessionRenewalInfo
} from './session/types'

// Error exports
export { 
  ScaleboxError,
  SandboxError,
  CodeInterpreterError,
  InvalidArgumentError,
  NotFoundError,
  NotEnoughSpaceError,
  AuthenticationError,
  formatSandboxTimeoutError
} from './errors'

// Utility exports
export * from './utils'

// Default export
import { Sandbox } from './sandbox'
export default Sandbox