/**
 * gRPC Client Module
 * 
 * Provides Connect RPC client for sandbox services including filesystem and process management.
 * This client uses Connect protocol for maximum compatibility with proxies and load balancers.
 * 
 * Key Services:
 * - Filesystem: File operations (read, write, list, watch, etc.)
 * - Process: Process management (start, stop, stream I/O, etc.)
 * 
 * Architecture:
 * - Uses @connectrpc/connect for RPC communication
 * - Supports authentication via Bearer tokens
 * - Automatic interceptor-based header injection
 * - Type-safe service clients from generated protobuf definitions
 */

import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { ConnectionConfig } from '../connectionConfig'
import { Filesystem, Process } from '../generated/api_pb.js'

/**
 * gRPC Client for Sandbox Services
 * 
 * Provides access to filesystem and process management services via Connect RPC.
 * Automatically handles authentication and connection setup.
 * 
 * @example
 * ```typescript
 * const client = new GrpcClient(
 *   connectionConfig,
 *   'sandbox-123.example.com',
 *   'access-token-xyz'
 * );
 * 
 * // Use filesystem service
 * const files = await client.filesystem.listDir({ path: '/workspace' });
 * 
 * // Use process service
 * const proc = await client.process.start({ ... });
 * 
 * // Cleanup
 * client.close();
 * ```
 */
export class GrpcClient {
  private transport: ReturnType<typeof createConnectTransport>

  /** Filesystem service client for file operations */
  public filesystem: any
  
  /** Process service client for process management */
  public process: any

  /**
   * Create a new gRPC client
   * 
   * @param connectionConfig - Connection configuration with gRPC address
   * @param sandboxDomain - Optional sandbox-specific domain (overrides config domain)
   * @param envdAccessToken - Optional access token for authentication
   */
  constructor(
    connectionConfig: ConnectionConfig,
    sandboxDomain?: string,
    envdAccessToken?: string
  ) {
    // Determine the gRPC address to use
    let grpcAddress = connectionConfig.grpcAddress
    
    // If a specific sandboxDomain is provided, use it instead
    if (sandboxDomain) {
      if (sandboxDomain.startsWith('http://') || sandboxDomain.startsWith('https://')) {
        grpcAddress = sandboxDomain
      } else if (sandboxDomain.includes('localhost') || sandboxDomain.includes('127.0.0.1')) {
        grpcAddress = `http://${sandboxDomain}`
      } else {
        grpcAddress = `https://${sandboxDomain}`
      }
    }
    
    this.transport = createConnectTransport({
      baseUrl: grpcAddress,
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

    // Initialize service clients with generated protobuf services
    this.filesystem = createClient(Filesystem, this.transport)
    this.process = createClient(Process, this.transport)
  }

  /**
   * Close the client and cleanup resources
   * 
   * Currently a no-op as Connect transport doesn't require explicit cleanup,
   * but provided for API compatibility and future enhancements.
   */
  close(): void {
    // No-op for compatibility - Connect transport handles cleanup automatically
  }
}

/**
 * Factory function to create a gRPC client
 * 
 * Convenience function for creating a GrpcClient instance with standard configuration.
 * 
 * @param connectionConfig - Connection configuration
 * @param sandboxDomain - Optional sandbox domain
 * @param envdAccessToken - Optional access token for authentication
 * @returns Configured GrpcClient instance
 * 
 * @example
 * ```typescript
 * const client = createGrpcClient(
 *   connectionConfig,
 *   'my-sandbox.example.com',
 *   'token123'
 * );
 * ```
 */
export function createGrpcClient(
  connectionConfig: ConnectionConfig,
  sandboxDomain?: string,
  envdAccessToken?: string
): GrpcClient {
  return new GrpcClient(connectionConfig, sandboxDomain, envdAccessToken)
}
