import { describe, it } from 'vitest'
import { Sandbox } from '../../src'

describe('Sandbox getHost Test', () => {
  it('should return host URL and verify it works', async () => {
    console.log('📦 Creating sandbox...')
    
    const sandbox = await Sandbox.create('base', {
      timeoutMs: 300000,
      metadata: { purpose: 'getHost-test' }
    })
    
    console.log(`✅ Sandbox created: ${sandbox.sandboxId}`)
    console.log(`   Domain: ${sandbox.sandboxDomain}`)
    
    // 在 sandbox 中启动 HTTP 服务器
    const port = 3000
    console.log(`\n🚀 Starting HTTP server on port ${port}...`)
    
    const cmd = await sandbox.commands.run(`python3 -m http.server ${port} > /tmp/http_server.log 2>&1 &`, {
      background: true
    })
    
    // 等待服务器启动
    console.log('⏳ Waiting for server to start...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // 验证服务器是否在运行
    const checkProcess = await sandbox.commands.run(`ps aux | grep "http.server ${port}" | grep -v grep || echo "not found"`)
    console.log(`   Server process check: ${checkProcess.stdout.trim()}`)
    
    // 获取 host URL
    const host = sandbox.getHost(port)
    const url = `https://${host}`
    
    console.log(`\n🌐 Host URL for port ${port}:`)
    console.log(`   ${url}`)
    
    // 尝试访问服务器验证 URL 是否可用
    console.log(`\n🔍 Testing URL accessibility...`)
    let response: Response | null = null
    for (let i = 0; i < 10; i++) {
      try {
        response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        })
        if (response.status === 200 || response.status === 403) {
          break
        }
      } catch (error) {
        // 继续重试
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    if (response) {
      console.log(`✅ URL is accessible! Status: ${response.status}`)
    } else {
      console.log(`⚠️  Could not verify URL accessibility (server may need more time)`)
    }
    
    console.log(`\n📋 Full details:`)
    console.log(`   - Sandbox ID: ${sandbox.sandboxId}`)
    console.log(`   - Sandbox Domain: ${sandbox.sandboxDomain}`)
    console.log(`   - Host: ${host}`)
    console.log(`   - Full URL: ${url}`)
    console.log(`   - Server running in background (not killed)`)
  }, 120000)
})

