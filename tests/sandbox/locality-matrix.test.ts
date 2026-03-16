import { beforeAll, describe, expect, it } from 'vitest'
import { SandboxApi } from '../../src/sandbox/sandboxApi'
import type { LocalityConfig, SandboxInfo } from '../../src/sandbox/types'

const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY
const CREATE_TIMEOUT_MS = 60_000
const CASE_TIMEOUT_MS = 180_000
const INVALID_REGION = 'invalid-e2e-region'

const KNOWN_REGION_CANDIDATES = [
  'af-south',
  'sa-east',
  'eu-central',
  'ap-south',
  'ap-northeast',
  'us-west',
  'eu-west',
  'ap-southeast',
  'us-east'
]

type MatrixContext = {
  availableRegions: Set<string>
  primaryRegion: string
  secondaryRegion: string
  noCapacityRegion: string
}

type MatrixCase = {
  name: string
  locality?: (ctx: MatrixContext) => LocalityConfig | undefined
  expect: {
    success: boolean
    errorContains?: string[]
  }
}

const ctx: MatrixContext = {
  availableRegions: new Set<string>(),
  primaryRegion: '',
  secondaryRegion: '',
  noCapacityRegion: ''
}

function textOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function containsAny(text: string, candidates: string[]): boolean {
  return candidates.some((item) => text.includes(item))
}

async function safeKill(sandboxId?: string): Promise<void> {
  if (!sandboxId) {
    return
  }
  try {
    await SandboxApi.kill(sandboxId)
  } catch (error) {
    console.warn(`[locality-matrix] cleanup failed for ${sandboxId}: ${textOf(error)}`)
  }
}

async function createForCase(caseName: string, locality?: LocalityConfig): Promise<SandboxInfo> {
  return SandboxApi.createSandbox('base', CREATE_TIMEOUT_MS, {
    metadata: {
      suite: 'locality-matrix',
      caseName
    },
    locality
  })
}

async function discoverNoCapacityRegion(): Promise<string> {
  const candidates = KNOWN_REGION_CANDIDATES.filter((region) => !ctx.availableRegions.has(region))

  for (const region of candidates) {
    let sandbox: SandboxInfo | undefined
    try {
      sandbox = await createForCase(`probe-force-${region}`, { region, force: true })
      // Region has capacity (or backend behavior changed). Cleanup and try next candidate.
      await safeKill(sandbox.sandboxId)
      continue
    } catch (error) {
      const message = textOf(error)
      if (containsAny(message, ['locality_constraint_failed', 'No available cluster in requested region'])) {
        return region
      }
      if (containsAny(message, ['invalid_region', 'Invalid region'])) {
        continue
      }
      // For unexpected transient failures, continue probing other candidates.
      console.warn(`[locality-matrix] probe region=${region} got unexpected error: ${message}`)
      continue
    }
  }

  throw new Error(
    'Could not find a "valid but no-capacity" region to verify fallback(force=false)/failure(force=true) semantics'
  )
}

const matrixCases: MatrixCase[] = [
  {
    name: 'no_locality',
    expect: { success: true }
  },
  {
    name: 'locality_empty',
    locality: () => ({}),
    expect: { success: true }
  },
  {
    name: 'auto_false',
    locality: () => ({ autoDetect: false }),
    expect: { success: true }
  },
  {
    name: 'auto_true',
    locality: () => ({ autoDetect: true }),
    expect: { success: true }
  },
  {
    name: 'force_only',
    locality: () => ({ force: true }),
    expect: { success: true }
  },
  {
    name: 'auto_true_force_true',
    locality: () => ({ autoDetect: true, force: true }),
    expect: { success: true }
  },
  {
    name: 'region_only_primary',
    locality: (c) => ({ region: c.primaryRegion }),
    expect: { success: true }
  },
  {
    name: 'region_primary_force_false',
    locality: (c) => ({ region: c.primaryRegion, force: false }),
    expect: { success: true }
  },
  {
    name: 'region_primary_force_true',
    locality: (c) => ({ region: c.primaryRegion, force: true }),
    expect: { success: true }
  },
  {
    name: 'region_primary_auto_true',
    locality: (c) => ({ region: c.primaryRegion, autoDetect: true }),
    expect: { success: true }
  },
  {
    name: 'region_secondary_force_true',
    locality: (c) => ({ region: c.secondaryRegion, force: true }),
    expect: { success: true }
  },
  {
    name: 'region_no_cluster_force_false',
    locality: (c) => ({ region: c.noCapacityRegion, force: false }),
    expect: { success: true }
  },
  {
    name: 'region_no_cluster_force_true',
    locality: (c) => ({ region: c.noCapacityRegion, force: true }),
    expect: {
      success: false,
      errorContains: ['locality_constraint_failed', 'No available cluster in requested region']
    }
  },
  {
    name: 'region_invalid',
    locality: () => ({ region: INVALID_REGION }),
    expect: {
      success: false,
      errorContains: ['invalid_region', 'Invalid region']
    }
  },
  {
    name: 'region_invalid_force_true',
    locality: () => ({ region: INVALID_REGION, force: true }),
    expect: {
      success: false,
      errorContains: ['invalid_region', 'Invalid region']
    }
  },
  {
    name: 'region_invalid_auto_true',
    locality: () => ({ region: INVALID_REGION, autoDetect: true }),
    expect: {
      success: false,
      errorContains: ['invalid_region', 'Invalid region']
    }
  }
]

describe('Locality matrix (real API)', () => {
  describe.skipIf(skipIfNoApiKey)('16-case matrix', () => {
    beforeAll(async () => {
      const regions = await SandboxApi.getScaleboxRegions()
      expect(regions.length).toBeGreaterThan(0)

      ctx.availableRegions = new Set(regions.map((item) => item.id))
      ctx.primaryRegion = regions[0].id
      ctx.secondaryRegion = regions[1]?.id ?? regions[0].id
      ctx.noCapacityRegion = await discoverNoCapacityRegion()

      console.log('[locality-matrix] available regions=', [...ctx.availableRegions].join(','))
      console.log('[locality-matrix] primary=', ctx.primaryRegion)
      console.log('[locality-matrix] secondary=', ctx.secondaryRegion)
      console.log('[locality-matrix] no-capacity=', ctx.noCapacityRegion)
    }, 120_000)

    for (const item of matrixCases) {
      it(
        item.name,
        async () => {
          const locality = item.locality?.(ctx)
          let sandbox: SandboxInfo | undefined

          try {
            sandbox = await createForCase(item.name, locality)

            if (!item.expect.success) {
              throw new Error(
                `expected failure but succeeded (sandboxId=${sandbox.sandboxId}, locality=${JSON.stringify(locality)})`
              )
            }

            expect(sandbox.sandboxId).toBeTruthy()
            expect(sandbox.sandboxDomain).toBeTruthy()

            if (item.name === 'region_no_cluster_force_false') {
              expect(ctx.availableRegions.has(ctx.noCapacityRegion)).toBe(false)
            }
          } catch (error) {
            const message = textOf(error)
            if (item.expect.success) {
              throw new Error(`expected success but failed: ${message}`)
            }
            if (item.expect.errorContains && !containsAny(message, item.expect.errorContains)) {
              throw new Error(
                `expected error containing one of ${JSON.stringify(item.expect.errorContains)}, got: ${message}`
              )
            }
          } finally {
            await safeKill(sandbox?.sandboxId)
          }
        },
        CASE_TIMEOUT_MS
      )
    }
  })
})
