import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { isIntegrationTest } from '../setup'

const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

describe('API Client - Template CRUD', () => {
  let client: ApiClient

  beforeEach(() => {
    if (process.env.SCALEBOX_API_KEY || isIntegrationTest) {
      client = new ApiClient(new ConnectionConfig())
    }
  })

  describe.skipIf(skipIfNoApiKey)('listTemplates', () => {
    it('should return templates with camelCase fields', async () => {
      const res = await client!.listTemplates()
      expect(res).toHaveProperty('templates')
      expect(res).toHaveProperty('total')
      expect(Array.isArray(res.templates)).toBe(true)
      if (res.templates.length > 0) {
        const t = res.templates[0]
        expect(t).toHaveProperty('templateId')
        expect(t).toHaveProperty('name')
        expect(t).toHaveProperty('status')
      }
    })

    it('should accept usable filter', async () => {
      const res = await client!.listTemplates({ usable: true })
      expect(res).toHaveProperty('templates')
      expect(res).toHaveProperty('total')
    })
  })

  describe.skipIf(skipIfNoApiKey)('getTemplate', () => {
    it('should return template with camelCase fields', async () => {
      const list = await client!.listTemplates({ usable: true })
      if (list.templates.length === 0) return
      const firstId = list.templates[0].templateId
      const t = await client!.getTemplate(firstId)
      expect(t).toHaveProperty('templateId', firstId)
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('status')
      expect(t).toHaveProperty('defaultCpuCount')
      expect(t).toHaveProperty('defaultMemoryMb')
    })
  })

  describe.skipIf(skipIfNoApiKey)('getTemplateChain', () => {
    it('should return chain array and depth', async () => {
      const list = await client!.listTemplates({ usable: true })
      if (list.templates.length === 0) return
      const firstId = list.templates[0].templateId
      const res = await client!.getTemplateChain(firstId)
      expect(res).toHaveProperty('chain')
      expect(res).toHaveProperty('depth')
      expect(Array.isArray(res.chain)).toBe(true)
      expect(res.depth).toBeGreaterThanOrEqual(0)
      if (res.chain.length > 0) {
        expect(res.chain[0]).toHaveProperty('templateId')
        expect(res.chain[0]).toHaveProperty('name')
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('getTemplateDockerfile', () => {
    it('should return dockerfile as plain text', async () => {
      const list = await client!.listTemplates({ usable: true })
      if (list.templates.length === 0) return
      const firstId = list.templates[0].templateId
      const text = await client!.getTemplateDockerfile(firstId)
      expect(typeof text).toBe('string')
      expect(text).toContain('FROM')
    })
  })

  describe.skipIf(skipIfNoApiKey)('create from sandbox then get and delete', () => {
    let sandboxId: string | null = null
    let templateId: string | null = null

    afterEach(async () => {
      if (templateId && client) {
        try {
          await client.deleteTemplate(templateId)
        } catch {
          // ignore
        }
      }
      if (sandboxId && client) {
        try {
          await client.terminateSandbox(sandboxId)
        } catch {
          // ignore
        }
      }
    })

    it('should create template from sandbox then deleteTemplate', async () => {
      const list = await client!.listTemplates({ usable: true })
      const templateForSandbox = list.templates.length > 0 ? list.templates[0].templateId : 'base'
      const created = await client!.createSandbox({
        template: templateForSandbox,
        timeout: 300,
        metadata: { test: 'template-crud' }
      })
      sandboxId = created.sandboxId

      await client!.waitUntilStatus(sandboxId, ['running', 'failed'], { timeoutMs: 120_000 })
      const sandbox = await client!.getSandbox(sandboxId)
      if (sandbox.status !== 'running') {
        return
      }

      const name = `crud-${Date.now()}`
      const template = await client!.createTemplateFromSandbox(sandboxId, { name })
      templateId = template.templateId
      expect(template.name).toBe(name)
      expect(template.templateId).toBeDefined()

      await client!.deleteTemplate(templateId).catch(() => {})
      templateId = null
    })
  })
})
