/**
 * Example: Validate an external image, then either import it to Harbor or register
 * it as an external-pull template. Demonstrates both modes, private registry
 * credentials, image command extraction, and full template configuration.
 *
 * Two modes (mirrors the frontend's "Register only" checkbox):
 *   - Import (default): copies the image into Scalebox's Harbor registry for faster
 *     sandbox startup. Requires waiting for the import job to finish.
 *   - Register-only: references the external image directly. No import job — the
 *     template is usable immediately, but sandbox startup pulls from the external
 *     registry each time.
 *
 * Flow (import):    validateCustomImage -> directImportTemplate -> waitUntilImportComplete -> createSandbox
 * Flow (register):  validateCustomImage -> createTemplate (custom/external) -> createSandbox
 *
 * Run with: npx tsx examples/template-import.ts
 *
 * Environment variables:
 *   SCALEBOX_API_KEY / SCALEBOX_ACCESS_TOKEN  — authentication (required)
 *   SCALEBOX_API_URL                          — API base URL (optional)
 *   SCALEBOX_IMPORT_IMAGE_URL                 — image to import (default: docker.io/library/nginx:alpine)
 *   SCALEBOX_REGISTRY_USER                    — username for private registries (optional)
 *   SCALEBOX_REGISTRY_PASS                    — password for private registries (optional)
 *   SCALEBOX_REGISTER_ONLY                    — set to "true" to skip Harbor import (default: false)
 */

import { ApiClient } from '../src/api'
import { ConnectionConfig } from '../src/connectionConfig'

// ---------------------------------------------------------------------------
// Configuration — all tuneable via env vars or change these defaults
// ---------------------------------------------------------------------------
const IMAGE_URL = process.env.SCALEBOX_IMPORT_IMAGE_URL || 'docker.io/library/nginx:alpine'
const REGISTRY_USER = process.env.SCALEBOX_REGISTRY_USER || ''
const REGISTRY_PASS = process.env.SCALEBOX_REGISTRY_PASS || ''
const REGISTER_ONLY = process.env.SCALEBOX_REGISTER_ONLY === 'true'

// ---------------------------------------------------------------------------
// Port serialization helper — mirrors the frontend pattern in sandbox-page.tsx.
// Excludes `servicePort` (backend-assigned) and only includes `protocol` when
// it differs from the default (TCP).
// ---------------------------------------------------------------------------
interface PortEntry {
  port: number
  name: string
  protocol?: string
  is_protected?: boolean
}

function serializePorts(ports: PortEntry[]): string {
  return JSON.stringify(
    ports.map(({ port, name, protocol, is_protected }) => {
      const o: Record<string, unknown> = { port, name }
      if (protocol && protocol !== 'TCP') o.protocol = protocol
      if (is_protected !== undefined) o.is_protected = is_protected
      return o
    })
  )
}

async function main() {
  const config = new ConnectionConfig()
  const client = new ApiClient(config)

  const templateName = `sdk-import-${Date.now()}`

  // Shared template parameters for both modes
  const ports: PortEntry[] = [
    { port: 80, name: 'http', is_protected: false },
    { port: 443, name: 'https', protocol: 'TCP', is_protected: true }
  ]
  const portsJson = serializePorts(ports)

  // -- Step 1: Validate image and extract commands -----------------------------
  console.log('1. Validating custom image:', IMAGE_URL)
  const validateReq: Parameters<typeof client.validateCustomImage>[0] = { imageUrl: IMAGE_URL }
  if (REGISTRY_USER) {
    validateReq.username = REGISTRY_USER
    validateReq.password = REGISTRY_PASS
  }
  const validation = await client.validateCustomImage(validateReq)
  if (!validation.valid) {
    throw new Error(`Image validation failed: ${validation.error ?? validation.message}`)
  }
  console.log('   Valid. Size (GB):', validation.sizeGb?.toFixed(2) ?? 'unknown')

  // Backend requires custom_command for custom templates in JSON exec form:
  // {"Entrypoint": string[], "Cmd": string[]}. ready_command is plain text.
  const entrypoint = validation.entrypoint ?? []
  const cmd = validation.cmd ?? []
  const customCommand =
    entrypoint.length > 0 || cmd.length > 0
      ? JSON.stringify({ Entrypoint: entrypoint, Cmd: cmd })
      : undefined
  if (customCommand) {
    console.log('   Detected command (exec form):', customCommand)
  }

  // -- Step 2: Create template (branching on mode) -----------------------------
  let templateId: string

  if (REGISTER_ONLY) {
    // Register-only mode: the template references the external image directly.
    // No import job is created — sandboxes pull from the external registry at
    // startup. Useful when the image is frequently updated or hosted on a fast
    // registry close to your cluster.
    console.log('2. Registering template (external image, no Harbor import)...')
    const template = await client.createTemplate({
      name: templateName,
      description: 'SDK register-only example (external pull)',
      templateSource: 'custom',
      customImageSource: 'external',
      externalImageUrl: IMAGE_URL,

      // Private registry credentials — only sent when non-empty
      ...(REGISTRY_USER
        ? { externalRegistryUsername: REGISTRY_USER, externalRegistryPassword: REGISTRY_PASS }
        : {}),

      // Resource defaults: CPU 1-64 cores, memory 256-16384 MB
      defaultCpuCount: 2,
      defaultMemoryMb: 2048,

      visibility: 'private',
      ports: portsJson,

      // Command from image inspection (or override manually)
      ...(customCommand ? { customCommand } : {}),
      readyCommand: 'curl -sf http://localhost:80/ || exit 1'
    })
    templateId = template.templateId
    console.log('   Template ID:', templateId, '(immediately usable)')
  } else {
    // Import mode (default): copies the image into Scalebox's Harbor registry.
    // This gives faster sandbox startup since the image is already local to the
    // cluster. An import job runs in the background.
    console.log('2. Starting direct import (create template + import in one step)...')
    const result = await client.directImportTemplate({
      name: templateName,
      description: 'SDK import example (Harbor-cached)',
      externalImageUrl: IMAGE_URL,

      // Private registry credentials — only sent when non-empty
      ...(REGISTRY_USER
        ? { externalRegistryUsername: REGISTRY_USER, externalRegistryPassword: REGISTRY_PASS }
        : {}),

      // Resource defaults
      defaultCpuCount: 2,
      defaultMemoryMb: 2048,

      visibility: 'private',
      ports: portsJson,

      ...(customCommand ? { customCommand } : {}),
      readyCommand: 'curl -sf http://localhost:80/ || exit 1'
    })
    templateId = result.templateId
    console.log('   Template ID:', templateId, 'Job ID:', result.jobId ?? 'n/a')

    // -- Step 3: Wait for import to complete ------------------------------------
    console.log('3. Waiting for import to complete (up to 10 min)...')
    const final = await client.waitUntilImportComplete(templateId, { timeoutMs: 600_000 })
    if (final.status !== 'completed') {
      throw new Error(
        `Import ended with status: ${final.status}${final.errorMessage ? ` - ${final.errorMessage}` : ''}`
      )
    }
    console.log('   Import completed.')
  }

  // -- Step 4: Create sandbox from the template --------------------------------
  console.log(`${REGISTER_ONLY ? '3' : '4'}. Creating sandbox from template...`)
  const sandbox = await client.createSandbox({
    template: templateId,
    timeout: 120
  })
  console.log('   Sandbox ID:', sandbox.sandboxId)

  // -- Cleanup -----------------------------------------------------------------
  console.log(`${REGISTER_ONLY ? '4' : '5'}. Cleaning up: deleting sandbox and template...`)
  await client.deleteSandbox(sandbox.sandboxId).catch(() => {})
  await client.deleteTemplate(templateId).catch(() => {})
  console.log('   Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
