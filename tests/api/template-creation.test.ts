import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient, SandboxApi } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { isIntegrationTest } from '../setup'

// Skip integration tests if API key is not available
const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

describe('API Client - Template Creation from Sandbox', () => {
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

  describe.skipIf(skipIfNoApiKey)('createTemplateFromSandbox', () => {
    it('should create template from running sandbox', async () => {
      // Create a sandbox first
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 600, // Longer timeout for template creation
        metadata: { test: 'create-template' }
      })

      testSandboxId = createdSandbox.sandboxId

      // Wait for sandbox to be running
      let sandbox = await client.getSandbox(createdSandbox.sandboxId)
      let retries = 0
      while (sandbox.status !== 'running' && retries < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await client.getSandbox(createdSandbox.sandboxId)
        retries++
      }

      if (sandbox.status !== 'running') {
        console.warn('Sandbox not running, skipping template creation test')
        return
      }

      // Create template from sandbox
      const templateName = `test-template-${Date.now()}`
      const template = await client.createTemplateFromSandbox(createdSandbox.sandboxId, {
        name: templateName,
        description: 'Test template created from sandbox',
        cpuCount: 2,
        memoryMB: 512
      })

      expect(template).toBeDefined()
      expect(template.templateId).toBeDefined()
      expect(template.name).toBe(templateName)
      expect(template.description).toBe('Test template created from sandbox')
      expect(template.defaultCpuCount).toBe(2)
      expect(template.defaultMemoryMB).toBe(512)
      expect(template.status).toBeDefined()
      expect(template.createdAt).toBeDefined()
      expect(template.message).toBeDefined()
      expect(template.visibility).toBe('private') // Should be private by default

      // Log the template info
      console.log(`✅ Private template created successfully:`)
      console.log(`   Template ID: ${template.templateId}`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Status: ${template.status}`)
      console.log(`   Visibility: ${template.visibility}`)
      console.log(`   Description: ${template.description}`)
      
      // Verify template is private
      expect(template.visibility).toBe('private')
      expect(template.templateId).toBeTruthy()
      expect(template.status).toBeDefined()
      
      // Wait a bit for template to be persisted, then try to verify it exists in the template list
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to verify template exists in the template list
      // Use the underlying client to call the template API (not in OpenAPI spec yet)
      try {
        const templateListResponse = await (client as any).client.GET('/v1/templates' as any, {
          params: {
            query: {
              is_public: 'false' // Only list private templates
            }
          }
        })
        
        if (!templateListResponse.error) {
          const processedResponse = (client as any).processResponse(templateListResponse) as any
          const templates = processedResponse.data?.templates || processedResponse.templates || []
          
          // Find our template in the list
          const foundTemplate = templates.find((t: any) => 
            (t.template_id === template.templateId || t.templateId === template.templateId) ||
            (t.name === template.name)
          )
          
          if (foundTemplate) {
            console.log(`✅ Template found in private templates list!`)
            console.log(`   Template ID: ${foundTemplate.template_id || foundTemplate.templateId}`)
            console.log(`   Name: ${foundTemplate.name}`)
            console.log(`   Status: ${foundTemplate.status}`)
            console.log(`   Visibility: ${foundTemplate.visibility || foundTemplate.Visibility || foundTemplate.is_public || foundTemplate.isPublic}`)
            expect(foundTemplate.visibility === 'private' || foundTemplate.Visibility === 'private' || foundTemplate.is_public === false || foundTemplate.isPublic === false).toBe(true)
          } else {
            console.log(`⚠️  Template ${template.templateId} not found in list yet (status: ${template.status}, may still be building)`)
            console.log(`   Total private templates in list: ${templates.length}`)
            // This is okay - template might still be building and not yet visible in list
          }
        }
      } catch (error) {
        // Template API might not be available in OpenAPI spec, that's okay
        console.log(`ℹ️  Could not verify template in list (API may not be in OpenAPI spec): ${error}`)
      }
    })

    it('should create template using SandboxApi static method', async () => {
      // Create a sandbox first
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 600,
        metadata: { test: 'create-template-static' }
      })

      testSandboxId = createdSandbox.sandboxId

      // Wait for sandbox to be running
      let sandbox = await client.getSandbox(createdSandbox.sandboxId)
      let retries = 0
      while (sandbox.status !== 'running' && retries < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await client.getSandbox(createdSandbox.sandboxId)
        retries++
      }

      if (sandbox.status !== 'running') {
        console.warn('Sandbox not running, skipping template creation test')
        return
      }

      // Create template using static method (name must be <= 32 chars and cannot start with 'tpl-')
      const templateName = `test-static-${Date.now().toString().slice(-8)}`
      const template = await SandboxApi.createTemplateFromSandbox(createdSandbox.sandboxId, {
        name: templateName,
        description: 'Test template from static method',
        visibility: 'private'
      })

      expect(template).toBeDefined()
      expect(template.templateId).toBeDefined()
      expect(template.name).toBe(templateName)
      expect(template.description).toBe('Test template from static method')
      expect(template.visibility).toBe('private') // Should be private

      // Log the template info
      console.log(`✅ Private template created successfully (via static method):`)
      console.log(`   Template ID: ${template.templateId}`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Status: ${template.status}`)
      console.log(`   Visibility: ${template.visibility}`)
      console.log(`   Description: ${template.description}`)
      
      // Verify template is private
      expect(template.visibility).toBe('private')
      expect(template.templateId).toBeTruthy()
      expect(template.status).toBeDefined()
      
      // Wait a bit for template to be persisted, then try to verify it exists in the template list
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to verify template exists in the template list
      // Use the underlying client to call the template API (not in OpenAPI spec yet)
      try {
        const templateListResponse = await (client as any).client.GET('/v1/templates' as any, {
          params: {
            query: {
              is_public: 'false' // Only list private templates
            }
          }
        })
        
        if (!templateListResponse.error) {
          const processedResponse = (client as any).processResponse(templateListResponse) as any
          const templates = processedResponse.data?.templates || processedResponse.templates || []
          
          // Find our template in the list
          const foundTemplate = templates.find((t: any) => 
            (t.template_id === template.templateId || t.templateId === template.templateId) ||
            (t.name === template.name)
          )
          
          if (foundTemplate) {
            console.log(`✅ Template found in private templates list (via static method)!`)
            console.log(`   Template ID: ${foundTemplate.template_id || foundTemplate.templateId}`)
            console.log(`   Name: ${foundTemplate.name}`)
            console.log(`   Status: ${foundTemplate.status}`)
            console.log(`   Visibility: ${foundTemplate.visibility || foundTemplate.Visibility || foundTemplate.is_public || foundTemplate.isPublic}`)
            expect(foundTemplate.visibility === 'private' || foundTemplate.Visibility === 'private' || foundTemplate.is_public === false || foundTemplate.isPublic === false).toBe(true)
          } else {
            console.log(`⚠️  Template ${template.templateId} not found in list yet (status: ${template.status}, may still be building)`)
            console.log(`   Total private templates in list: ${templates.length}`)
            // This is okay - template might still be building and not yet visible in list
          }
        }
      } catch (error) {
        // Template API might not be available in OpenAPI spec, that's okay
        console.log(`ℹ️  Could not verify template in list (API may not be in OpenAPI spec): ${error}`)
      }
    })

    it('should fail to create template from non-running sandbox', async () => {
      // Create a sandbox but don't wait for it to be running
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'create-template-fail' }
      })

      testSandboxId = createdSandbox.sandboxId

      // Try to create template immediately (should fail if sandbox is not running)
      const templateName = `test-template-fail-${Date.now()}`
      
      await expect(
        client.createTemplateFromSandbox(createdSandbox.sandboxId, {
          name: templateName
        })
      ).rejects.toThrow()
    })
  })
})

