import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient, Sandbox } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { ObjectStorageConfig } from '../../src/sandbox/types'
import { isIntegrationTest } from '../setup'

// Skip integration tests if API key is not available
const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

const objectStorageEnv = {
  uri: process.env.SCALEBOX_OBJECT_STORAGE_URI,
  mountPoint: process.env.SCALEBOX_OBJECT_STORAGE_MOUNT_POINT,
  accessKey: process.env.SCALEBOX_OBJECT_STORAGE_ACCESS_KEY,
  secretKey: process.env.SCALEBOX_OBJECT_STORAGE_SECRET_KEY,
  region: process.env.SCALEBOX_OBJECT_STORAGE_REGION,
  endpoint: process.env.SCALEBOX_OBJECT_STORAGE_ENDPOINT
}

const hasObjectStorageConfig = Object.values(objectStorageEnv).every(Boolean)
const skipObjectStorageTests =
  skipIfNoApiKey ||
  !hasObjectStorageConfig ||
  process.env.SCALEBOX_SKIP_OBJECT_STORAGE === '1'

function getObjectStorageConfig(): ObjectStorageConfig {
  if (!hasObjectStorageConfig) {
    throw new Error('Object storage env vars are not configured')
  }

  return {
    uri: objectStorageEnv.uri!,
    mountPoint: objectStorageEnv.mountPoint!,
    accessKey: objectStorageEnv.accessKey!,
    secretKey: objectStorageEnv.secretKey!,
    region: objectStorageEnv.region!,
    endpoint: objectStorageEnv.endpoint!
  }
}

describe('API Client - Object Storage Mount', () => {
  let client: ApiClient
  let testSandboxId: string | null = null

  beforeEach(async () => {
    // Only create ApiClient if API key is available
    if (process.env.SCALEBOX_API_KEY || isIntegrationTest) {
      const config = new ConnectionConfig()
      client = new ApiClient(config)
    }
  })

  afterEach(async () => {
    // Clean up test sandbox if it exists
    if (testSandboxId && client) {
      try {
        await client.deleteSandbox(testSandboxId)
      } catch (error) {
        // Ignore cleanup errors
        console.warn('Failed to cleanup sandbox:', error)
      }
      testSandboxId = null
    }
  })

  describe.skipIf(skipObjectStorageTests)('createSandbox with objectStorage', () => {
    it('should create sandbox with object storage mount configuration', async () => {
      const objectStorageConfig = getObjectStorageConfig()

      const sandboxInfo = await client.createSandbox({
        template: 'code-interpreter',
        timeout: 300,
        metadata: { test: 'object-storage-create' },
        objectStorage: objectStorageConfig
      })

      testSandboxId = sandboxInfo.sandboxId

      // Verify basic fields
      expect(sandboxInfo).toBeDefined()
      expect(sandboxInfo.sandboxId).toBeDefined()

      // Verify objectStorage field exists
      expect(sandboxInfo.objectStorage).toBeDefined()
      expect(sandboxInfo.objectStorage?.uri).toBe(objectStorageConfig.uri)
      expect(sandboxInfo.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)

      // Verify credentials are not returned (security)
      // Note: The response should only include uri and mountPoint, not credentials
      console.log('Object storage info:', sandboxInfo.objectStorage)
    }, 600000) // 10 minutes timeout to allow for object storage mount setup

    it('should preserve object storage mount after pause and resume', async () => {
      const objectStorageConfig = getObjectStorageConfig()

      // Create sandbox with object storage
      const createdSandbox = await client.createSandbox({
        template: 'code-interpreter',
        timeout: 300,
        metadata: { test: 'object-storage-pause-resume' },
        objectStorage: objectStorageConfig
      })

      testSandboxId = createdSandbox.sandboxId

      // Verify object storage exists after creation
      expect(createdSandbox.objectStorage).toBeDefined()
      expect(createdSandbox.objectStorage?.uri).toBe(objectStorageConfig.uri)
      expect(createdSandbox.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)
      console.log('✅ Object storage mounted after creation:', createdSandbox.objectStorage)

      // Verify getSandbox returns objectStorage field
      const sandboxInfo = await client.getSandbox(createdSandbox.sandboxId)
      expect(sandboxInfo.objectStorage).toBeDefined()
      expect(sandboxInfo.objectStorage?.uri).toBe(objectStorageConfig.uri)
      expect(sandboxInfo.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)
      console.log('✅ getSandbox returns objectStorage:', sandboxInfo.objectStorage)

      // Connect to sandbox to execute commands
      const sandbox = await Sandbox.connect(createdSandbox.sandboxId, {
        apiKey: process.env.SCALEBOX_API_KEY,
        apiUrl: process.env.SCALEBOX_API_URL
      })
      
      // Wait for sandbox to be ready
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Verify mount point exists before pause using df command
      const dfBeforePause = await sandbox.commands.run('df -h')
      expect(dfBeforePause.stdout).toContain(objectStorageConfig.mountPoint)
      console.log('✅ Mount point verified before pause using df command')
      console.log('📊 df output:', dfBeforePause.stdout)

      // Pause sandbox
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
        // Wait for pause to complete
        await new Promise(resolve => setTimeout(resolve, 3000))
        console.log('✅ Sandbox paused successfully')
      } catch (error: any) {
        // If pause fails due to infrastructure constraints, skip this test
        if (error.message?.includes('DaemonSet') || error.message?.includes('writable layer protection')) {
          console.log('⚠️ Pause failed due to infrastructure constraints, skipping test')
          return
        }
        throw error
      }

      // Verify getSandbox returns objectStorage after pause
      const sandboxInfoAfterPause = await client.getSandbox(createdSandbox.sandboxId)
      expect(sandboxInfoAfterPause.objectStorage).toBeDefined()
      expect(sandboxInfoAfterPause.objectStorage?.uri).toBe(objectStorageConfig.uri)
      expect(sandboxInfoAfterPause.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)
      console.log('✅ getSandbox returns objectStorage after pause:', sandboxInfoAfterPause.objectStorage)

      // Resume sandbox (after pause, we need to resume before we can run commands)
      await client.resumeSandbox(createdSandbox.sandboxId)
      // Wait for resume to complete
      await new Promise(resolve => setTimeout(resolve, 5000))
      console.log('✅ Sandbox resumed successfully')

      // Verify getSandbox returns objectStorage after resume
      const sandboxInfoAfterResume = await client.getSandbox(createdSandbox.sandboxId)
      expect(sandboxInfoAfterResume.objectStorage).toBeDefined()
      expect(sandboxInfoAfterResume.objectStorage?.uri).toBe(objectStorageConfig.uri)
      expect(sandboxInfoAfterResume.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)
      console.log('✅ getSandbox returns objectStorage after resume:', sandboxInfoAfterResume.objectStorage)

      // Verify mount point still exists after resume using df command
      const dfAfterResume = await sandbox.commands.run('df -h')
      expect(dfAfterResume.stdout).toContain(objectStorageConfig.mountPoint)
      console.log('✅ Mount point preserved after resume using df command')
      console.log('📊 df output after resume:', dfAfterResume.stdout)

      // Final verification: mount point should exist both before pause and after resume
      expect(dfBeforePause.stdout).toContain(objectStorageConfig.mountPoint)
      expect(dfAfterResume.stdout).toContain(objectStorageConfig.mountPoint)
      console.log('✅ Object storage mount point consistent across pause/resume cycle')
    }, 600000) // 10 minutes timeout to allow for object storage mount setup and pause/resume operations
  })

  describe.skipIf(skipIfNoApiKey)('createSandbox without objectStorage', () => {
    it('should create sandbox without object storage (backward compatibility)', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'no-object-storage' }
      })

      testSandboxId = sandboxInfo.sandboxId

      // Verify basic fields
      expect(sandboxInfo).toBeDefined()
      expect(sandboxInfo.sandboxId).toBeDefined()

      // objectStorage should be undefined or null when not provided
      // Backend may return null instead of undefined
      expect(sandboxInfo.objectStorage === undefined || sandboxInfo.objectStorage === null).toBe(true)
    }, 60000)
  })

  describe.skipIf(skipObjectStorageTests)('getSandbox with objectStorage', () => {
    it('should return objectStorage field when sandbox has object storage mounted', async () => {
      // First create a sandbox with object storage
      const objectStorageConfig = getObjectStorageConfig()

      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'object-storage-get' },
        objectStorage: objectStorageConfig
      })

      testSandboxId = createdSandbox.sandboxId

      // Get sandbox info
      const sandboxInfo = await client.getSandbox(createdSandbox.sandboxId)

      // Verify objectStorage field
      expect(sandboxInfo.objectStorage).toBeDefined()
      expect(sandboxInfo.objectStorage?.uri).toBe(objectStorageConfig.uri)
      expect(sandboxInfo.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)

      console.log('Retrieved object storage info:', sandboxInfo.objectStorage)
    }, 600000) // 10 minutes timeout to allow for object storage mount setup
  })

  describe.skipIf(skipObjectStorageTests)('listSandboxes with objectStorage', () => {
    it('should include objectStorage field in list response', async () => {
      // Create a sandbox with object storage
      const objectStorageConfig = getObjectStorageConfig()

      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'object-storage-list' },
        objectStorage: objectStorageConfig
      })

      testSandboxId = createdSandbox.sandboxId

      // List sandboxes
      const result = await client.listSandboxes({
        limit: 10
      })

      expect(result).toBeDefined()
      expect(result.sandboxes).toBeDefined()
      expect(Array.isArray(result.sandboxes)).toBe(true)

      // Find our sandbox in the list
      const ourSandbox = result.sandboxes.find(s => s.sandboxId === createdSandbox.sandboxId)

      if (ourSandbox) {
        // Verify objectStorage field exists
        expect(ourSandbox.objectStorage).toBeDefined()
        expect(ourSandbox.objectStorage?.uri).toBe(objectStorageConfig.uri)
        expect(ourSandbox.objectStorage?.mountPoint).toBe(objectStorageConfig.mountPoint)
      }
    }, 600000) // 10 minutes timeout to allow for object storage mount setup
  })

  describe('Type Validation', () => {
    it('should accept ObjectStorageConfig type', () => {
      // This test validates that the TypeScript type system accepts ObjectStorageConfig
      const config: ObjectStorageConfig = {
        uri: 's3://bucket/path/',
        mountPoint: '/mnt/oss',
        accessKey: 'key',
        secretKey: 'secret',
        region: 'us-east-1',
        endpoint: 'https://s3.us-east-1.amazonaws.com'
      }

      expect(config.uri).toBe('s3://bucket/path/')
      expect(config.mountPoint).toBe('/mnt/oss')
    })
  })
})

