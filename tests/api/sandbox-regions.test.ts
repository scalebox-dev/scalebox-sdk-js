import { describe, it, expect } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'

describe('Sandbox Regions API', () => {
  it('parses sandbox regions from standard response wrapper', async () => {
    const config = new ConnectionConfig({
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost'
    })
    const client = new ApiClient(config) as any

    client.client = {
      GET: async () => ({
        data: {
          success: true,
          data: {
            sandbox_regions: [
              { id: 'us-east', name: 'US East (N. Virginia)' },
              { id: 'eu-west', name: 'Europe West (Ireland)' }
            ]
          }
        }
      })
    }

    const regions = await client.getSandboxRegions()

    expect(regions).toEqual([
      { id: 'us-east', name: 'US East (N. Virginia)' },
      { id: 'eu-west', name: 'Europe West (Ireland)' }
    ])
  })
})
