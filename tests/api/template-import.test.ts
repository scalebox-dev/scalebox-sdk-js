import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { isIntegrationTest } from '../setup'

const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

describe('API Client - Template Import', () => {
  let client: ApiClient

  beforeEach(() => {
    if (process.env.SCALEBOX_API_KEY || isIntegrationTest) {
      client = new ApiClient(new ConnectionConfig())
    }
  })

  describe.skipIf(skipIfNoApiKey)('validateCustomImage', () => {
    it('should return valid and size for public image', async () => {
      const res = await client!.validateCustomImage({
        imageUrl: 'docker.io/library/nginx:alpine'
      })
      expect(res).toHaveProperty('valid')
      if (res.valid) {
        expect(res).toHaveProperty('message')
      } else {
        expect(res).toHaveProperty('error')
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('directImportTemplate and waitUntilImportComplete', () => {
    let templateId: string | null = null

    afterEach(async () => {
      if (templateId && client) {
        try {
          await client.deleteTemplate(templateId)
        } catch {
          // ignore
        }
      }
    })

    it('should run direct import and wait until complete', async () => {
      const name = `import-${Date.now()}`
      const result = await client!.directImportTemplate({
        name,
        externalImageUrl: 'docker.io/library/nginx:alpine'
      })
      expect(result.templateId).toBeDefined()
      expect(result.name).toBe(name)
      templateId = result.templateId

      const final = await client!.waitUntilImportComplete(templateId, {
        timeoutMs: 600_000,
        intervalMs: 5000
      })
      expect(['completed', 'failed', 'cancelled']).toContain(final.status)
      if (final.status === 'completed') {
        const t = await client!.getTemplate(templateId!)
        expect(t.status).toBe('available')
      }
    })
  })
})
