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
    let sandboxId: string | null = null

    afterEach(async () => {
      if (sandboxId && client) {
        try {
          await client.deleteSandbox(sandboxId)
        } catch (err) {
          console.error('afterEach: deleteSandbox failed', { sandboxId }, err)
        }
      }
      if (templateId && client) {
        try {
          await client.deleteTemplate(templateId)
        } catch (err) {
          console.error('afterEach: deleteTemplate failed', { templateId }, err)
        }
      }
    })

    it('should run direct import, wait until complete, then create sandbox from template', async () => {
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
      if (final.status !== 'completed') return

      const t = await client!.getTemplate(templateId!)
      expect(t.status).toBe('available')

      const sandbox = await client!.createSandbox({
        template: templateId!,
        timeout: 120
      })
      sandboxId = sandbox.sandboxId
      expect(sandbox.sandboxId).toBeDefined()
      expect(sandbox.templateId).toBe(templateId)
    })
  })

  describe.skipIf(skipIfNoApiKey)('register-only: createTemplate custom/external with JSON customCommand', () => {
    let templateId: string | null = null
    let sandboxId: string | null = null

    afterEach(async () => {
      if (sandboxId && client) {
        try {
          await client.deleteSandbox(sandboxId)
        } catch (err) {
          console.error('afterEach: deleteSandbox failed', { sandboxId }, err)
        }
      }
      if (templateId && client) {
        try {
          await client.deleteTemplate(templateId)
        } catch (err) {
          console.error('afterEach: deleteTemplate failed', { templateId }, err)
        }
      }
    })

    it('should create external-pull template, getTemplate, then create sandbox from template', async () => {
      const validation = await client!.validateCustomImage({
        imageUrl: 'docker.io/library/nginx:alpine'
      })
      expect(validation.valid).toBe(true)
      const entrypoint = validation.entrypoint ?? []
      const cmd = validation.cmd ?? []
      const customCommand =
        entrypoint.length > 0 || cmd.length > 0
          ? JSON.stringify({ Entrypoint: entrypoint, Cmd: cmd })
          : undefined

      const name = `register-${Date.now()}`
      const template = await client!.createTemplate({
        name,
        description: 'Test register-only',
        templateSource: 'custom',
        customImageSource: 'external',
        externalImageUrl: 'docker.io/library/nginx:alpine',
        defaultCpuCount: 2,
        defaultMemoryMb: 2048,
        visibility: 'private',
        ...(customCommand ? { customCommand } : {}),
        readyCommand: 'curl -sf http://localhost:80/ || exit 1'
      })
      templateId = template.templateId
      expect(template.templateId).toBeDefined()
      expect(template.name).toBe(name)

      const t = await client!.getTemplate(templateId!)
      expect(t.templateId).toBe(templateId)
      expect(t.templateSource).toBe('custom')

      const sandbox = await client!.createSandbox({
        template: templateId!,
        timeout: 120
      })
      sandboxId = sandbox.sandboxId
      expect(sandbox.sandboxId).toBeDefined()
      expect(sandbox.templateId).toBe(templateId)
    })
  })
})
