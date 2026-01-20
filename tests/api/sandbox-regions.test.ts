import { describe, it, expect } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'

describe('Scalebox Regions API', () => {
  it('parses scalebox regions from standard response wrapper', async () => {
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
            scalebox_regions: [
              { id: 'us-east', name: 'US East (N. Virginia)' },
              { id: 'eu-west', name: 'Europe West (Ireland)' }
            ]
          }
        }
      })
    }

    const regions = await client.getScaleboxRegions()

    expect(regions).toEqual([
      { id: 'us-east', name: 'US East (N. Virginia)' },
      { id: 'eu-west', name: 'Europe West (Ireland)' }
    ])
  })
})
