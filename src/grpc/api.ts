/**
 * Scalebox gRPC API Factory
 * 
 * Provides factory functions for creating complete Scalebox API clients with all services.
 * This is a higher-level abstraction over individual service clients.
 * 
 * Services Included:
 * - Filesystem: File system operations
 * - Process: Process lifecycle management  
 * - ExecutionService: Code execution
 * - ContextService: Execution context management
 * 
 * Usage:
 * - For full API access: Use createScaleboxApi()
 * - For specific services: Use individual client classes from ./client or ../code-interpreter/client
 */

import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { ConnectionConfig } from '../connectionConfig'
import { ContextService, ExecutionService, Filesystem, Process } from '../generated/api_pb.js'

// Re-export all generated types for convenience
export * from '../generated/api_pb.js'

/**
 * Create a complete Scalebox API client with all services
 * 
 * Factory function that creates and configures clients for all Scalebox gRPC services.
 * All services share the same transport and authentication configuration.
 * 
 * @param sandboxDomain - Sandbox domain for gRPC endpoint (required, from sandbox creation)
 * @param envdAccessToken - Access token for Bearer authentication (required, from sandbox creation)
 * @param connectionConfig - Optional connection configuration
 * @returns Object containing all service clients
 * 
 * @example
 * ```typescript
 * const api = createScaleboxApi(
 *   'sbx-xxx.scalebox.dev',
 *   'access-token-xyz'
 * );
 * 
 * // Use filesystem service
 * await api.filesystem.stat({ path: '/file.txt' });
 * 
 * // Use execution service
 * const stream = await api.execution.execute({ code: 'print("hi")' });
 * 
 * // Use context service
 * const context = await api.context.createContext({ language: 'python' });
 * 
 * // Use process service
 * await api.process.start({ ... });
 * ```
 */
export function createScaleboxApi(
  sandboxDomain: string,
  envdAccessToken: string,
  connectionConfig?: ConnectionConfig
) {
  // Determine the gRPC address from sandboxDomain
  let grpcAddress: string
  if (sandboxDomain.startsWith('http://') || sandboxDomain.startsWith('https://')) {
    grpcAddress = sandboxDomain
  } else if (sandboxDomain.includes('localhost') || sandboxDomain.includes('127.0.0.1')) {
    grpcAddress = `http://${sandboxDomain}`
  } else {
    grpcAddress = `https://${sandboxDomain}`
  }

  // Create shared transport with authentication
  const transport = createConnectTransport({
    baseUrl: grpcAddress,
    useBinaryFormat: false, // Use JSON for better debugging
    interceptors: [
      (next) => async (req) => {
        // gRPC authentication requires TWO headers:
        // 1. Authorization: Bearer root (fixed)
        // 2. X-Access-Token: <envdAccessToken> (from sandbox creation)
        req.header.set('Authorization', 'Bearer root')
        if (envdAccessToken) {
          req.header.set('X-Access-Token', envdAccessToken)
        }
        return await next(req)
      },
    ],
  })

  // Create and return all service clients
  return {
    filesystem: createClient(Filesystem, transport),
    process: createClient(Process, transport),
    execution: createClient(ExecutionService, transport),
    context: createClient(ContextService, transport),
  }
}

/**
 * Type definition for the complete Scalebox API client
 * 
 * Provides type-safe access to all service clients returned by createScaleboxApi.
 * 
 * @example
 * ```typescript
 * const api: ScaleboxGrpcApi = createScaleboxApi(config);
 * ```
 */
export type ScaleboxGrpcApi = ReturnType<typeof createScaleboxApi>
