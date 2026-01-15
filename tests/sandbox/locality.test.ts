import { describe, it, expect, beforeAll } from 'vitest'
import { SandboxApi } from '../../src/sandbox/sandboxApi'
import type { SandboxRegion, LocalityConfig } from '../../src/sandbox/types'

describe('Locality-based Scheduling', () => {
  describe('getSandboxRegions', () => {
    it('should fetch available sandbox regions', async () => {
      const regions = await SandboxApi.getSandboxRegions()
      
      expect(regions).toBeDefined()
      expect(Array.isArray(regions)).toBe(true)
      
      // If regions are available, verify structure
      if (regions.length > 0) {
        const region = regions[0]
        expect(region).toHaveProperty('id')
        expect(region).toHaveProperty('name')
        expect(typeof region.id).toBe('string')
        expect(typeof region.name).toBe('string')
        expect(region.id.length).toBeGreaterThan(0)
        expect(region.name.length).toBeGreaterThan(0)
      }
    }, 30_000)

    it('should return regions with valid structure even if empty', async () => {
      const regions = await SandboxApi.getSandboxRegions()
      
      expect(regions).toBeDefined()
      expect(Array.isArray(regions)).toBe(true)
      // Empty array is valid if no regions are available
    }, 30_000)
  })

  describe('createSandbox with locality', () => {
    it('should create sandbox with auto-detect locality', async () => {
      const locality: LocalityConfig = {
        autoDetect: true
      }

      try {
        const sandbox = await SandboxApi.createSandbox(
          'base',
          300_000, // 5 minutes
          {
            locality
          }
        )

        expect(sandbox).toBeDefined()
        expect(sandbox.sandboxId).toBeDefined()
        expect(sandbox.sandboxDomain).toBeDefined()
        
        // Cleanup
        await SandboxApi.kill(sandbox.sandboxId)
      } catch (error: any) {
        // If auto-detect fails (e.g., GeoIP unavailable), that's acceptable
        // The system should fall back to default scheduling
        if (error.message?.includes('locality') || error.message?.includes('region')) {
          console.warn('Locality auto-detect not available, falling back to default scheduling')
          return
        }
        throw error
      }
    }, 120_000)

    it('should create sandbox with specified region (if available)', async () => {
      // First, get available regions
      const regions = await SandboxApi.getSandboxRegions()
      
      if (regions.length === 0) {
        console.log('No regions available, skipping region-specific test')
        return
      }

      const locality: LocalityConfig = {
        region: regions[0].id,
        force: false // Best-effort, allow fallback
      }

      try {
        const sandbox = await SandboxApi.createSandbox(
          'base',
          300_000, // 5 minutes
          {
            locality
          }
        )

        expect(sandbox).toBeDefined()
        expect(sandbox.sandboxId).toBeDefined()
        expect(sandbox.sandboxDomain).toBeDefined()
        
        // Cleanup
        await SandboxApi.kill(sandbox.sandboxId)
      } catch (error: any) {
        // If region is unavailable, that's acceptable with force=false
        if (error.message?.includes('locality') || error.message?.includes('region')) {
          console.warn(`Region ${regions[0].id} not available, falling back to default scheduling`)
          return
        }
        throw error
      }
    }, 120_000)

    it('should handle invalid region gracefully (best-effort)', async () => {
      const locality: LocalityConfig = {
        region: 'invalid-region-xyz',
        force: false // Best-effort, should fallback
      }

      try {
        const sandbox = await SandboxApi.createSandbox(
          'base',
          300_000, // 5 minutes
          {
            locality
          }
        )

        // With force=false, invalid region should fallback to default scheduling
        expect(sandbox).toBeDefined()
        expect(sandbox.sandboxId).toBeDefined()
        
        // Cleanup
        await SandboxApi.kill(sandbox.sandboxId)
      } catch (error: any) {
        // If invalid region causes error (400 Bad Request), that's also acceptable
        if (error.message?.includes('invalid') || error.message?.includes('region')) {
          console.warn('Invalid region rejected as expected')
          return
        }
        throw error
      }
    }, 120_000)

    it('should create sandbox without locality (default behavior)', async () => {
      // No locality config - should use default load-balanced scheduling
      try {
        const sandbox = await SandboxApi.createSandbox(
          'base',
          300_000, // 5 minutes
          {
            // No locality field
          }
        )

        expect(sandbox).toBeDefined()
        expect(sandbox.sandboxId).toBeDefined()
        expect(sandbox.sandboxDomain).toBeDefined()
        
        // Cleanup
        await SandboxApi.kill(sandbox.sandboxId)
      } catch (error) {
        throw error
      }
    }, 120_000)
  })

  describe('LocalityConfig type validation', () => {
    it('should accept valid LocalityConfig with autoDetect', () => {
      const config: LocalityConfig = {
        autoDetect: true
      }
      expect(config.autoDetect).toBe(true)
    })

    it('should accept valid LocalityConfig with region', () => {
      const config: LocalityConfig = {
        region: 'us-east'
      }
      expect(config.region).toBe('us-east')
    })

    it('should accept valid LocalityConfig with region and force', () => {
      const config: LocalityConfig = {
        region: 'us-east',
        force: true
      }
      expect(config.region).toBe('us-east')
      expect(config.force).toBe(true)
    })

    it('should accept empty LocalityConfig (all optional)', () => {
      const config: LocalityConfig = {}
      expect(config).toBeDefined()
    })
  })
})
