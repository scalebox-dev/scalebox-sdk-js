/**
 * gRPC Module - Main Entry Point
 * 
 * This module provides Connect RPC clients for all Scalebox services.
 * It exports both low-level service clients and high-level API factories.
 * 
 * Module Organization:
 * - client.ts: Core GrpcClient class for filesystem and process services
 * - api.ts: High-level API factory (createScaleboxApi) for all services
 * - errors.ts: Error handling utilities and type guards
 * 
 * Quick Start:
 * ```typescript
 * import { createScaleboxApi } from './grpc';
 * 
 * const api = createScaleboxApi(connectionConfig, accessToken);
 * await api.filesystem.stat({ path: '/file.txt' });
 * ```
 * 
 * Or use individual clients:
 * ```typescript
 * import { GrpcClient } from './grpc';
 * 
 * const client = new GrpcClient(config, domain, token);
 * await client.filesystem.listDir({ path: '/' });
 * ```
 */

// Core client exports
export { createGrpcClient, GrpcClient } from './client'

// API factory exports
export { createScaleboxApi, type ScaleboxGrpcApi } from './api'

// Error utilities
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
} from './errors'

// Re-export all generated protobuf types for convenience
export * from '../generated/api_pb.js'
