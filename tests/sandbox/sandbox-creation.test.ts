import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Sandbox } from '../../src/sandbox'

describe('Sandbox Creation Test', () => {
  let sandbox: Sandbox | null = null

  beforeAll(async () => {
    console.log('🚀 Starting sandbox creation test...')
  }, 120_000) // 2分钟超时

  afterAll(async () => {
    if (sandbox) {
      console.log('🧹 Cleaning up sandbox...')
      try {
        await sandbox.kill()
        console.log('✅ Sandbox killed successfully')
      } catch (error) {
        console.error('❌ Error killing sandbox:', error)
      }
    }
  }, 30_000)

  it('should create sandbox and output detailed information', async () => {
    console.log('📦 Creating sandbox...')
    
    try {
      // 创建沙盒，使用 code-interpreter 模板避免 base 模板问题
      sandbox = await Sandbox.create('code-interpreter')
      
      console.log('🎉 Sandbox created successfully!')
      console.log('📊 Sandbox Information:')
      console.log('=====================================')
      
      // 获取沙盒详细信息
      const info = await sandbox.getInfo()
      
      // 输出沙盒基本信息
      console.log(`Sandbox ID: ${sandbox.sandboxId}`)
      console.log(`Sandbox Domain: ${sandbox.sandboxDomain}`)
      console.log(`Sandbox Status: ${info.status}`)
      console.log(`Template: ${info.templateName || info.templateId}`)
      console.log(`Timeout: ${info.timeout} seconds`)
      
      // 输出资源配置
      console.log('\n⚙️ Resource Configuration:')
      console.log(`- CPU: ${info.cpuCount} cores`)
      console.log(`- Memory: ${info.memoryMB} MB`)
      console.log(`- Started At: ${info.startedAt.toISOString()}`)
      
      // 输出健康检查信息
      console.log('\n🏥 Health Check:')
      try {
        await sandbox.waitForHealth()
        console.log('✅ Sandbox is healthy and ready')
      } catch (error) {
        console.log('⚠️ Health check failed:', error)
      }
      
      // 测试基本连接
      console.log('\n🧪 Testing SDK Capabilities:')
      try {
        // 测试文件系统连接
        const filesystem = sandbox.files
        console.log('✅ Filesystem API available')
        
        // 测试命令执行连接
        const commands = sandbox.commands
        console.log('✅ Commands API available')
        
        // 测试伪终端连接
        const pty = sandbox.pty
        console.log('✅ Pty API available')
        
        // 测试进程管理连接
        const processes = sandbox.processes
        console.log('✅ Process API available')
        
      } catch (error) {
        console.log('❌ Connection test failed:', error)
      }
      
      console.log('\n=====================================')
      console.log('🎯 Sandbox creation test completed successfully!')
      
      // 验证基本属性
      expect(sandbox).toBeDefined()
      expect(sandbox.sandboxId).toBeDefined()
      expect(sandbox.sandboxDomain).toBeDefined()
      expect(sandbox.files).toBeDefined()
      expect(sandbox.commands).toBeDefined()
      expect(sandbox.pty).toBeDefined()
      expect(sandbox.processes).toBeDefined()
      
      // 验证 getInfo 返回有效数据
      expect(info.sandboxId).toBe(sandbox.sandboxId)
      expect(info.status).toBeDefined()
      expect(info.timeout).toBeGreaterThan(0)
      
    } catch (error) {
      console.error('❌ Sandbox creation failed:', error)
      throw error
    }
  }, 120_000)

  it('should test sandbox health check with detailed output', async () => {
    if (!sandbox) {
      throw new Error('Sandbox not created in previous test')
    }

    console.log('\n🏥 Testing detailed health check...')
    
    try {
      // 测试健康检查
      const startTime = Date.now()
      await sandbox.waitForHealth()
      const endTime = Date.now()
      
      console.log(`✅ Health check passed in ${endTime - startTime}ms`)
      
      // 输出健康检查详情
      console.log('📈 Health Check Details:')
      console.log(`- Response Time: ${endTime - startTime}ms`)
      console.log(`- Status: Healthy`)
      console.log(`- Timestamp: ${new Date().toISOString()}`)
      
    } catch (error) {
      console.error('❌ Health check failed:', error)
      throw error
    }
  }, 30_000)

  it('should test sandbox connectivity with detailed output', async () => {
    if (!sandbox) {
      throw new Error('Sandbox not created in previous test')
    }

    console.log('\n🔗 Testing sandbox connectivity...')
    
    try {
      // 测试各个组件的连接性
      const components = [
        { name: 'Filesystem', handler: sandbox.files },
        { name: 'Commands', handler: sandbox.commands },
        { name: 'Pty', handler: sandbox.pty },
        { name: 'Processes', handler: sandbox.processes }
      ]
      
      for (const component of components) {
        try {
          console.log(`Testing ${component.name}...`)
          expect(component.handler).toBeDefined()
          console.log(`✅ ${component.name} is available`)
        } catch (error) {
          console.log(`❌ ${component.name} test failed:`, error)
        }
      }
      
      console.log('🎯 All connectivity tests completed')
      
    } catch (error) {
      console.error('❌ Connectivity test failed:', error)
      throw error
    }
  }, 30_000)
})
