/**
 * Example: Create a template from a running sandbox with full configuration.
 *
 * Demonstrates all `createTemplateFromSandbox` parameters: ports (with JSON
 * serialization matching the frontend pattern), CPU/memory, visibility,
 * custom/ready commands, and resetPorts.
 *
 * Flow: createSandbox(base) -> wait running -> createTemplateFromSandbox (full params)
 *       -> poll getTemplate until available -> createSandbox(templateId) -> cleanup.
 *
 * Run with: npx tsx examples/template-from-sandbox.ts
 * Requires: SCALEBOX_API_KEY or SCALEBOX_ACCESS_TOKEN and SCALEBOX_API_URL (optional)
 */

import { ApiClient } from '../src/api'
import { ConnectionConfig } from '../src/connectionConfig'

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

  // -- Step 1: Create a base sandbox -------------------------------------------
  console.log('1. Creating base sandbox...')
  const sandbox = await client.createSandbox({
    template: 'base',
    timeout: 300,
    metadata: { example: 'template-from-sandbox' }
  })
  console.log('   Sandbox ID:', sandbox.sandboxId)

  // -- Step 2: Wait for sandbox to be running ----------------------------------
  console.log('2. Waiting for sandbox to be running...')
  let status = await client.getSandboxStatus(sandbox.sandboxId)
  while (status.status !== 'running' && status.status !== 'failed') {
    await new Promise(r => setTimeout(r, 2000))
    status = await client.getSandboxStatus(sandbox.sandboxId)
  }
  if (status.status === 'failed') {
    throw new Error(`Sandbox failed: ${status.reason ?? 'unknown'}`)
  }

  // -- Step 3: Create template from sandbox with full parameters ---------------
  console.log('3. Creating template from sandbox...')
  const templateName = `sdk-example-${Date.now()}`

  // Realistic multi-port configuration
  const ports: PortEntry[] = [
    { port: 3000, name: 'web-server', is_protected: true },
    { port: 8080, name: 'api' },
    { port: 9229, name: 'debugger' }
  ]

  const created = await client.createTemplateFromSandbox(sandbox.sandboxId, {
    // Name: 3-100 chars, allowed characters: [a-zA-Z0-9_-\s]
    name: templateName,
    description: 'Full-featured template created via SDK example',

    // Visibility options: 'private' | 'account_shared' | 'public'
    // 'account_shared' shares with all members of your account (requires admin role).
    // 'public' makes the template visible to all users (requires platform admin).
    visibility: 'private',

    // CPU: 1-64 cores
    cpuCount: 4,
    // Memory (MB): valid options are 256, 512, 1024, 2048, 4096, 8192, 16384
    memoryMB: 4096,

    // Ports as a JSON string — use the serialization helper above.
    // The backend expects snake_case keys (port, name, protocol, is_protected).
    ports: serializePorts(ports),

    // resetPorts: when false (default), the new template inherits ports from the
    // source sandbox's template and merges them with the ports specified here.
    // Set to true to discard inherited ports and use only the ones above.
    resetPorts: false

    // Omit customCommand and readyCommand so the template uses the base image's
    // default entrypoint and readiness. If you pass them: derived template inherits
    // template_source from base (scalebox_family), so customCommand must be plain text
    // (not JSON). readyCommand is always plain text (e.g. "curl -sf http://localhost:80/ || exit 1").
  })
  console.log('   Template ID:', created.templateId)

  // -- Step 4: Poll until template is available --------------------------------
  console.log('4. Polling until template is available...')
  await new Promise(r => setTimeout(r, 3000))
  let t = await client.getTemplate(created.templateId)
  while (t.status !== 'available' && t.status !== 'failed') {
    await new Promise(r => setTimeout(r, 5000))
    t = await client.getTemplate(created.templateId)
  }
  if (t.status === 'failed') {
    throw new Error('Template build failed')
  }
  console.log('   Template status:', t.status)

  // -- Step 5: Create a new sandbox from the template --------------------------
  console.log('5. Creating a new sandbox from the template...')
  const sandbox2 = await client.createSandbox({
    template: created.templateId,
    timeout: 120
  })
  console.log('   New sandbox ID:', sandbox2.sandboxId)

  // -- Step 6: Cleanup ---------------------------------------------------------
  console.log('6. Cleaning up: deleting both sandboxes and template...')
  await client.deleteSandbox(sandbox.sandboxId).catch(() => {})
  await client.deleteSandbox(sandbox2.sandboxId).catch(() => {})
  await client.deleteTemplate(created.templateId).catch(() => {})
  console.log('   Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
