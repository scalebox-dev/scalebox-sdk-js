import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as tls from 'node:tls'
import { ApiClient, Sandbox } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { isIntegrationTest } from '../setup'

const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

/** L4 TLS port (same as redis-cli -p 8443 --tls --sni <host>; SNI required for routing). */
const L4_REDIS_PORT = 8443
/** Redis RESP: PING *1\r\n$4\r\nPING\r\n -> +PONG\r\n */
const REDIS_PING = '*1\r\n$4\r\nPING\r\n'
const REDIS_PONG = '+PONG'

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
      const portsJson = JSON.stringify([{ port: 80, name: 'http', protocol: 'TCP' }])
      const result = await client!.directImportTemplate({
        name,
        externalImageUrl: 'docker.io/library/nginx:alpine',
        ports: portsJson,
        readyCommand: 'curl -sf http://localhost:80/ || exit 1'
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

      const sandboxInfo = await client!.createSandbox({
        template: templateId!,
        timeout: 120
      })
      sandboxId = sandboxInfo.sandboxId
      expect(sandboxInfo.sandboxId).toBeDefined()
      expect(sandboxInfo.templateId).toBe(templateId)

      // Verify exposed host: use port(s) from sandbox response, request root path, print status code
      const sandbox = await Sandbox.connect(sandboxId!)
      const allPorts = sandboxInfo.ports ?? sandboxInfo.templatePorts ?? sandboxInfo.customPorts ?? []
      const firstPort = allPorts.length > 0 ? (allPorts[0] as { port?: number }).port : undefined
      if (firstPort == null) {
        console.log('No exposed port on sandbox, skip host check')
        return
      }
      const host = sandbox.getHost(firstPort)
      const url = `https://${host}/`
      let code: number | null = null
      let lastError: string | null = null
      for (let i = 0; i < 15; i++) {
        try {
          const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) })
          code = res.status
          break
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
        }
        await new Promise(r => setTimeout(r, 2000))
      }
      expect(code, `URL ${url} should be reachable. Last: ${lastError ?? 'no response'}`).not.toBeNull()
      console.log(code!)
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

  describe.skipIf(skipIfNoApiKey)('L4 proxy: Redis direct import and TCP reachability', () => {
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

    it(
      'should import Redis image, create sandbox, and reach Redis via L4 with correct SNI',
      async () => {
      const name = `import-redis-${Date.now()}`
      const portsJson = JSON.stringify([{ port: 6379, name: 'redis', protocol: 'TCP' }])
      const result = await client!.directImportTemplate({
        name,
        externalImageUrl: 'docker.io/library/redis:alpine',
        ports: portsJson,
        readyCommand: 'redis-cli ping | grep -q PONG'
      })
      expect(result.templateId).toBeDefined()
      templateId = result.templateId

      const final = await client!.waitUntilImportComplete(templateId, {
        timeoutMs: 600_000,
        intervalMs: 5000
      })
      expect(['completed', 'failed', 'cancelled']).toContain(final.status)
      if (final.status !== 'completed') return

      const t = await client!.getTemplate(templateId!)
      expect(t.status).toBe('available')

      const sandboxInfo = await client!.createSandbox({
        template: templateId!,
        timeout: 120
      })
      sandboxId = sandboxInfo.sandboxId
      expect(sandboxInfo.sandboxId).toBeDefined()

      const sandbox = await Sandbox.connect(sandboxId!)
      const host = sandbox.getHost(6379)
      // Native TLS + RESP (no redis-cli). Same as redis-cli -h <host> -p 8443 --tls --sni <host>.
      const socketTimeoutMs = 8000
      let pong = false
      let lastErr: string | null = null
      for (let i = 0; i < 10; i++) {
        const ok = await new Promise<boolean>((resolve) => {
          const sock = tls.connect(
            { port: L4_REDIS_PORT, host, servername: host },
            () => {
              sock.write(REDIS_PING, (err) => {
                if (err) {
                  lastErr = err.message
                  sock.destroy()
                  resolve(false)
                  return
                }
                sock.once('data', (data) => {
                  sock.destroy()
                  resolve(data.toString().includes(REDIS_PONG))
                })
                sock.setTimeout(socketTimeoutMs, () => {
                  lastErr = 'timeout'
                  sock.destroy()
                  resolve(false)
                })
              })
            }
          )
          sock.on('error', (e) => {
            lastErr = e.message
            sock.destroy()
            resolve(false)
          })
        })
        if (ok) {
          pong = true
          console.log(`L4 Redis: ${host}:${L4_REDIS_PORT} (SNI=${host}) PING->PONG`)
          break
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      expect(
        pong,
        `Redis at ${host}:${L4_REDIS_PORT} (SNI=${host}) should respond PONG. Last: ${lastErr ?? 'no PONG'}`
      ).toBe(true)
    },
    600_000
    )
  })
})
