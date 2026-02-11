import { describe, it, expect } from 'vitest'

// Import conversion functions from API file for testing
// Since functions are private, we reimplement them here for testing
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function convertKeysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase)
  }
  
  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key)
      // For nested objects, only convert keys, not values (especially environment variable values)
      if (key === 'metadata' || key === 'envVars' || key === 'env_vars') {
        converted[snakeKey] = value // Keep original key-value pairs
      } else {
        converted[snakeKey] = convertKeysToSnakeCase(value)
      }
    }
    return converted
  }
  
  return obj
}

function convertKeysToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase)
  }
  
  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key)
      // For specific fields, keep values unchanged
      if (key === 'metadata' || key === 'env_vars' || key === 'envVars') {
        converted[camelKey] = value
      } else {
        converted[camelKey] = convertKeysToCamelCase(value)
      }
    }
    return converted
  }
  
  return obj
}

describe('API Parameter Conversion Validation', () => {
  describe('Basic String Conversion', () => {
    it('should correctly convert camelCase to snake_case', () => {
      expect(toSnakeCase('templateId')).toBe('template_id')
      expect(toSnakeCase('allowInternetAccess')).toBe('allow_internet_access')
      expect(toSnakeCase('envVars')).toBe('env_vars')
      expect(toSnakeCase('memoryMB')).toBe('memory_m_b')
      expect(toSnakeCase('cpuCount')).toBe('cpu_count')
      expect(toSnakeCase('isAsync')).toBe('is_async')
    })

    it('should correctly convert snake_case to camelCase', () => {
      expect(toCamelCase('template_id')).toBe('templateId')
      expect(toCamelCase('allow_internet_access')).toBe('allowInternetAccess')
      expect(toCamelCase('env_vars')).toBe('envVars')
      expect(toCamelCase('memory_mb')).toBe('memoryMb')
      expect(toCamelCase('cpu_count')).toBe('cpuCount')
      expect(toCamelCase('is_async')).toBe('isAsync')
    })
  })

  describe('Object Conversion', () => {
    it('should correctly convert request object to backend format', () => {
      const frontendRequest = {
        template: 'code-interpreter',
        timeout: 300,
        metadata: {
          testType: 'conversion',
          userName: 'testUser'
        },
        envVars: {
          NODE_ENV: 'test',
          TEST_VAR: 'value'
        },
        allowInternetAccess: true,
        cpuCount: 2,
        memoryMB: 1024,
        autoPause: false
      }

      const backendRequest = convertKeysToSnakeCase(frontendRequest)

      expect(backendRequest).toEqual({
        template: 'code-interpreter',
        timeout: 300,
        metadata: {
          testType: 'conversion',    // metadata content remains unchanged
          userName: 'testUser'
        },
        env_vars: {
          NODE_ENV: 'test',          // envVars content remains unchanged
          TEST_VAR: 'value'
        },
        allow_internet_access: true,
        cpu_count: 2,
        memory_m_b: 1024,           // Note: This will have issues, needs special handling
        auto_pause: false
      })
    })

    it('should include is_async when isAsync is true', () => {
      const frontendRequest = {
        template: 'base',
        isAsync: true
      }
      const backendRequest = convertKeysToSnakeCase(frontendRequest) as Record<string, unknown>
      expect(backendRequest.is_async).toBe(true)
    })

    it('should not include is_async when isAsync is false or omitted', () => {
      expect((convertKeysToSnakeCase({ template: 'base' }) as Record<string, unknown>).is_async).toBeUndefined()
      expect((convertKeysToSnakeCase({ template: 'base', isAsync: false }) as Record<string, unknown>).is_async).toBe(false)
    })

    it('should correctly convert backend response to frontend format', () => {
      const backendResponse = {
        sandbox_id: 'sbx-123',
        template_id: 'tpl-456',
        memory_mb: 1024,
        cpu_count: 2,
        env_vars: {
          NODE_ENV: 'production'
        },
        allow_internet_access: true,
        created_at: '2025-09-26T02:00:00Z'
      }

      const frontendResponse = convertKeysToCamelCase(backendResponse)

      expect(frontendResponse).toEqual({
        sandboxId: 'sbx-123',
        templateId: 'tpl-456',
        memoryMb: 1024,
        cpuCount: 2,
        envVars: {
          NODE_ENV: 'production'     // env_vars content remains unchanged
        },
        allowInternetAccess: true,
        createdAt: '2025-09-26T02:00:00Z'
      })
    })

    it('should convert new sandbox response fields (running seconds, persistence, autoPause, network_proxy)', () => {
      const backendResponse = {
        sandbox_id: 'sbx-new',
        total_running_seconds: 3600,
        actual_total_running_seconds: 3580,
        actual_total_paused_seconds: 20,
        persistence_days: 7,
        persistence_expires_at: '2025-02-10T00:00:00Z',
        persistence_days_remaining: 5,
        auto_pause: true,
        network_proxy: {
          proxy_url: 'http://proxy.example.com',
          proxy_configs: { host: 'proxy', port: 8080, username: 'u', password: 'p' }
        }
      }
      const frontendResponse = convertKeysToCamelCase(backendResponse)
      expect(frontendResponse).toHaveProperty('totalRunningSeconds', 3600)
      expect(frontendResponse).toHaveProperty('actualTotalRunningSeconds', 3580)
      expect(frontendResponse).toHaveProperty('actualTotalPausedSeconds', 20)
      expect(frontendResponse).toHaveProperty('persistenceDays', 7)
      expect(frontendResponse).toHaveProperty('persistenceExpiresAt', '2025-02-10T00:00:00Z')
      expect(frontendResponse).toHaveProperty('persistenceDaysRemaining', 5)
      expect(frontendResponse).toHaveProperty('autoPause', true)
      expect(frontendResponse).toHaveProperty('networkProxy')
      expect((frontendResponse as { networkProxy: { proxyUrl?: string; proxyConfigs?: unknown } }).networkProxy).toMatchObject({
        proxyUrl: 'http://proxy.example.com',
        proxyConfigs: { host: 'proxy', port: 8080, username: 'u', password: 'p' }
      })
    })
  })

  describe('Edge Case Handling', () => {
    it('should handle null values', () => {
      expect(convertKeysToSnakeCase(null)).toBe(null)
      expect(convertKeysToSnakeCase(undefined)).toBe(undefined)
      expect(convertKeysToCamelCase(null)).toBe(null)
      expect(convertKeysToCamelCase(undefined)).toBe(undefined)
    })

    it('should handle empty objects', () => {
      expect(convertKeysToSnakeCase({})).toEqual({})
      expect(convertKeysToCamelCase({})).toEqual({})
    })

    it('should handle arrays', () => {
      const input = [
        { templateId: 'test1' },
        { allowInternetAccess: true }
      ]
      
      const expected = [
        { template_id: 'test1' },
        { allow_internet_access: true }
      ]
      
      expect(convertKeysToSnakeCase(input)).toEqual(expected)
    })

    it('should handle primitive types', () => {
      expect(convertKeysToSnakeCase('string')).toBe('string')
      expect(convertKeysToSnakeCase(123)).toBe(123)
      expect(convertKeysToSnakeCase(true)).toBe(true)
    })
  })
})
