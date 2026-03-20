import { describe, it, expect, afterEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { ObjectStorageConfig } from '../../src/sandbox/types'

/**
 * Multi-path object storage integration test.
 *
 * Requires env vars:
 *   SCALEBOX_API_KEY
 *   SCALEBOX_API_URL                            (e.g. https://api.scalebocs.com)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   (for S3 bucket access)
 *   TEST_S3_BUCKET                              (bucket name)
 *   TEST_S3_REGION                              (bucket region)
 *   TEST_TEMPLATE                               (optional: template id, defaults to 'base')
 */

const bucket = process.env.TEST_S3_BUCKET
const region = process.env.TEST_S3_REGION || 'ap-southeast-1'
const accessKey = process.env.AWS_ACCESS_KEY_ID
const secretKey = process.env.AWS_SECRET_ACCESS_KEY
const apiKey = process.env.SCALEBOX_API_KEY
const template = process.env.TEST_TEMPLATE || 'base'

const canRun = !!(bucket && accessKey && secretKey && apiKey)

describe.skipIf(!canRun)('Multi-path object storage mount', () => {
  let client: ApiClient
  const sandboxIds: string[] = []

  function mounts(): ObjectStorageConfig[] {
    return [
      {
        uri: `s3://${bucket}/data/`,
        mountPoint: '/mnt/data',
        accessKey: accessKey!,
        secretKey: secretKey!,
        region,
      },
      {
        uri: `s3://${bucket}/models/`,
        mountPoint: '/mnt/models',
        accessKey: accessKey!,
        secretKey: secretKey!,
        region,
      },
    ]
  }

  function ensureClient() {
    if (!client) {
      client = new ApiClient(new ConnectionConfig())
    }
    return client
  }

  afterEach(async () => {
    for (const id of sandboxIds) {
      try {
        await client.deleteSandbox(id)
        console.log(`cleaned up: ${id}`)
      } catch {
        console.warn(`failed to cleanup: ${id}`)
      }
    }
    sandboxIds.length = 0
  })

  it('should mount two paths via sidecar (default mode)', async () => {
    const c = ensureClient()
    const configs = mounts()

    const info = await c.createSandbox({
      template,
      timeout: 300,
      metadata: { test: 'multi-path-sidecar' },
      objectStorages: configs,
    })
    sandboxIds.push(info.sandboxId)

    console.log('--- sidecar mode ---')
    console.log('sandboxId:', info.sandboxId)
    console.log('objectStorage:', JSON.stringify(info.objectStorage))
    console.log('objectStorages:', JSON.stringify(info.objectStorages))

    expect(info.objectStorage).toBeDefined()
    expect(info.objectStorage?.uri).toBe(configs[0].uri)
    expect(info.objectStorages).toHaveLength(2)

    const fetched = await c.getSandbox(info.sandboxId)
    expect(fetched.objectStorages).toHaveLength(2)
  }, 120_000)

  it('should mount two paths with directMount=true', async () => {
    const c = ensureClient()
    const configs = mounts()

    const info = await c.createSandbox({
      template,
      timeout: 300,
      metadata: { test: 'multi-path-direct' },
      objectStorages: configs,
      objectStorageDirectMount: true,
    })
    sandboxIds.push(info.sandboxId)

    console.log('--- direct mount ---')
    console.log('sandboxId:', info.sandboxId)
    console.log('objectStorage:', JSON.stringify(info.objectStorage))
    console.log('objectStorages:', JSON.stringify(info.objectStorages))

    expect(info.objectStorages).toHaveLength(2)

    const fetched = await c.getSandbox(info.sandboxId)
    expect(fetched.objectStorages).toHaveLength(2)
  }, 120_000)
})
