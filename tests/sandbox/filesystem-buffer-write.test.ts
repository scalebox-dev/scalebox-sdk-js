import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { Sandbox } from '../../src'
import { template } from '../template'
import fs from 'fs'
import path from 'path'
import os from 'os'

const timeout = 120_000 // 2分钟超时

// Health check function
async function waitForSandboxHealth(sandbox: Sandbox) {
  try {
    await sandbox.waitForHealth()
  } catch (error) {
    console.log('Health check failed, but continuing with test...')
  }
}

describe('Filesystem Buffer Write Tests', () => {
  let sandbox: Sandbox
  let tempDir: string

  beforeEach(async () => {
    // Create sandbox
    sandbox = await Sandbox.create(template, {
      timeoutMs: timeout,
    })

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scalebox-buffer-test-'))
  })

  afterEach(async () => {
    if (sandbox) {
      await sandbox.kill()
    }
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('String Content Write', () => {
    test('should write file with string content successfully', async () => {
      const testFilePath = '/tmp/test-string-write.txt'
      const testContent = 'This is a test string content.'
      
      await waitForSandboxHealth(sandbox)
      
      // Write file with string content
      const result = await sandbox.files.write(testFilePath, testContent)
      
      expect(result.name).toBe('test-string-write.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(testFilePath)
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe(testContent)
    }, timeout)

    test('should write file with Unicode string content', async () => {
      const testFilePath = '/tmp/test-unicode-write.txt'
      const testContent = '你好世界！Hello World! 🌍'
      
      await waitForSandboxHealth(sandbox)
      
      // Write file with Unicode string content
      const result = await sandbox.files.write(testFilePath, testContent)
      
      expect(result.name).toBe('test-unicode-write.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(testFilePath)
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe(testContent)
    }, timeout)

    test('should write empty string content', async () => {
      const testFilePath = '/tmp/test-empty-string.txt'
      const testContent = ''
      
      await waitForSandboxHealth(sandbox)
      
      // Write file with empty string
      const result = await sandbox.files.write(testFilePath, testContent)
      
      expect(result.name).toBe('test-empty-string.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(testFilePath)
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe('')
    }, timeout)
  })

  describe('Node.js Buffer Write', () => {
    test('should write file with Node.js Buffer successfully', async () => {
      const testFilePath = '/tmp/test-buffer-write.txt'
      const testContent = 'This is a test buffer content.'
      // Create Node.js Buffer
      const buffer = Buffer.from(testContent, 'utf-8')
      
      await waitForSandboxHealth(sandbox)
      
      // Convert Buffer to ArrayBuffer for write
      // Note: Node.js Buffer needs to be converted to ArrayBuffer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
      
      // Write file with ArrayBuffer
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-buffer-write.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(testFilePath)
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe(testContent)
    }, timeout)

    test('should write binary file with Node.js Buffer', async () => {
      const testFilePath = '/tmp/test-binary-buffer.bin'
      // Create binary data (example: 0-255 repeated)
      const binaryData = Buffer.alloc(1024)
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = i % 256
      }
      
      await waitForSandboxHealth(sandbox)
      
      // Convert Buffer to ArrayBuffer
      const arrayBuffer = binaryData.buffer.slice(
        binaryData.byteOffset,
        binaryData.byteOffset + binaryData.byteLength
      )
      
      // Write binary file
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-binary-buffer.bin')
      expect(result.type).toBe('file')
      
      // Verify file size
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(Number(fileInfo.size)).toBe(binaryData.length)
    }, timeout)

    test('should write file with empty Buffer', async () => {
      const testFilePath = '/tmp/test-empty-buffer.txt'
      const buffer = Buffer.alloc(0)
      
      await waitForSandboxHealth(sandbox)
      
      // Convert to ArrayBuffer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
      
      // Write empty buffer
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-empty-buffer.txt')
      expect(result.type).toBe('file')
      
      // Verify file is empty
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(Number(fileInfo.size)).toBe(0)
    }, timeout)

    test('should write file with Unicode content in Buffer', async () => {
      const testFilePath = '/tmp/test-unicode-buffer.txt'
      const testContent = '你好世界！Hello World! 🌍'
      const buffer = Buffer.from(testContent, 'utf-8')
      
      await waitForSandboxHealth(sandbox)
      
      // Convert to ArrayBuffer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
      
      // Write file with Buffer
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-unicode-buffer.txt')
      expect(result.type).toBe('file')
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe(testContent)
    }, timeout)
  })

  describe('ArrayBuffer Write', () => {
    test('should write file with ArrayBuffer successfully', async () => {
      const testFilePath = '/tmp/test-arraybuffer-write.txt'
      const testContent = 'This is a test ArrayBuffer content.'
      // Create ArrayBuffer using TextEncoder
      const encoder = new TextEncoder()
      const arrayBuffer = encoder.encode(testContent).buffer
      
      await waitForSandboxHealth(sandbox)
      
      // Write file with ArrayBuffer
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-arraybuffer-write.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(testFilePath)
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe(testContent)
    }, timeout)

    test('should write binary file with ArrayBuffer', async () => {
      const testFilePath = '/tmp/test-binary-arraybuffer.bin'
      // Create binary ArrayBuffer
      const arrayBuffer = new ArrayBuffer(1024)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256
      }
      
      await waitForSandboxHealth(sandbox)
      
      // Write binary file
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-binary-arraybuffer.bin')
      expect(result.type).toBe('file')
      
      // Verify file size
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(Number(fileInfo.size)).toBe(arrayBuffer.byteLength)
    }, timeout)

    test('should write empty ArrayBuffer', async () => {
      const testFilePath = '/tmp/test-empty-arraybuffer.bin'
      const arrayBuffer = new ArrayBuffer(0)
      
      await waitForSandboxHealth(sandbox)
      
      // Write empty ArrayBuffer
      const result = await sandbox.files.write(testFilePath, arrayBuffer)
      
      expect(result.name).toBe('test-empty-arraybuffer.bin')
      expect(result.type).toBe('file')
      
      // Verify file is empty
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(Number(fileInfo.size)).toBe(0)
    }, timeout)

    test('should write file with different typed arrays', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Test Uint8Array
      const uint8FilePath = '/tmp/test-uint8array.bin'
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5])
      await sandbox.files.write(uint8FilePath, uint8Array.buffer)
      let fileInfo = await sandbox.files.stat(uint8FilePath)
      expect(Number(fileInfo.size)).toBe(5)
      
      // Test Uint16Array
      const uint16FilePath = '/tmp/test-uint16array.bin'
      const uint16Array = new Uint16Array([256, 512, 1024])
      await sandbox.files.write(uint16FilePath, uint16Array.buffer)
      fileInfo = await sandbox.files.stat(uint16FilePath)
      expect(Number(fileInfo.size)).toBe(6) // 3 * 2 bytes
      
      // Test Uint32Array
      const uint32FilePath = '/tmp/test-uint32array.bin'
      const uint32Array = new Uint32Array([65536, 131072])
      await sandbox.files.write(uint32FilePath, uint32Array.buffer)
      fileInfo = await sandbox.files.stat(uint32FilePath)
      expect(Number(fileInfo.size)).toBe(8) // 2 * 4 bytes
      
      // Test Float32Array
      const float32FilePath = '/tmp/test-float32array.bin'
      const float32Array = new Float32Array([1.5, 2.5, 3.5])
      await sandbox.files.write(float32FilePath, float32Array.buffer)
      fileInfo = await sandbox.files.stat(float32FilePath)
      expect(Number(fileInfo.size)).toBe(12) // 3 * 4 bytes
    }, timeout)
  })

  describe('Blob Write', () => {
    test('should write file with Blob successfully', async () => {
      const testFilePath = '/tmp/test-blob-write.txt'
      const testContent = 'This is a test Blob content.'
      const blob = new Blob([testContent], { type: 'text/plain' })
      
      await waitForSandboxHealth(sandbox)
      
      // Write file with Blob
      const result = await sandbox.files.write(testFilePath, blob)
      
      expect(result.name).toBe('test-blob-write.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(testFilePath)
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe(testContent)
    }, timeout)

    test('should write binary file with Blob', async () => {
      const testFilePath = '/tmp/test-binary-blob.bin'
      const binaryData = new Uint8Array([0, 1, 2, 3, 4, 5, 255, 254, 253])
      const blob = new Blob([binaryData], { type: 'application/octet-stream' })
      
      await waitForSandboxHealth(sandbox)
      
      // Write binary file
      const result = await sandbox.files.write(testFilePath, blob)
      
      expect(result.name).toBe('test-binary-blob.bin')
      expect(result.type).toBe('file')
      
      // Verify file size
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(Number(fileInfo.size)).toBe(binaryData.length)
    }, timeout)

    test('should write file with multiple Blob parts', async () => {
      const testFilePath = '/tmp/test-multipart-blob.txt'
      const part1 = 'Hello '
      const part2 = 'World '
      const part3 = '!'
      const blob = new Blob([part1, part2, part3], { type: 'text/plain' })
      
      await waitForSandboxHealth(sandbox)
      
      // Write file with multi-part Blob
      const result = await sandbox.files.write(testFilePath, blob)
      
      expect(result.name).toBe('test-multipart-blob.txt')
      expect(result.type).toBe('file')
      
      // Verify file content
      const readContent = await sandbox.files.read(testFilePath)
      expect(readContent).toBe('Hello World !')
    }, timeout)

    test('should write empty Blob', async () => {
      const testFilePath = '/tmp/test-empty-blob.txt'
      const blob = new Blob([], { type: 'text/plain' })
      
      await waitForSandboxHealth(sandbox)
      
      // Write empty blob
      const result = await sandbox.files.write(testFilePath, blob)
      
      expect(result.name).toBe('test-empty-blob.txt')
      expect(result.type).toBe('file')
      
      // Verify file is empty
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(Number(fileInfo.size)).toBe(0)
    }, timeout)
  })

  describe('Mixed Content Types', () => {
    test('should overwrite file with different content types', async () => {
      const testFilePath = '/tmp/test-overwrite-mixed.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Write with string
      await sandbox.files.write(testFilePath, 'String content')
      let content = await sandbox.files.read(testFilePath)
      expect(content).toBe('String content')
      
      // Overwrite with Buffer
      const buffer = Buffer.from('Buffer content', 'utf-8')
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      await sandbox.files.write(testFilePath, arrayBuffer)
      content = await sandbox.files.read(testFilePath)
      expect(content).toBe('Buffer content')
      
      // Overwrite with Blob
      const blob = new Blob(['Blob content'])
      await sandbox.files.write(testFilePath, blob)
      content = await sandbox.files.read(testFilePath)
      expect(content).toBe('Blob content')
    }, timeout)

    test('should write multiple files with different content types concurrently', async () => {
      await waitForSandboxHealth(sandbox)
      
      const promises = [
        // String
        sandbox.files.write('/tmp/concurrent-string.txt', 'String content'),
        
        // Buffer
        (async () => {
          const buffer = Buffer.from('Buffer content', 'utf-8')
          const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
          return sandbox.files.write('/tmp/concurrent-buffer.txt', arrayBuffer)
        })(),
        
        // ArrayBuffer
        (async () => {
          const encoder = new TextEncoder()
          const arrayBuffer = encoder.encode('ArrayBuffer content').buffer
          return sandbox.files.write('/tmp/concurrent-arraybuffer.txt', arrayBuffer)
        })(),
        
        // Blob
        sandbox.files.write('/tmp/concurrent-blob.txt', new Blob(['Blob content']))
      ]
      
      const results = await Promise.all(promises)
      
      // Verify all files were created
      expect(results).toHaveLength(4)
      results.forEach(result => {
        expect(result.type).toBe('file')
      })
      
      // Verify contents
      const stringContent = await sandbox.files.read('/tmp/concurrent-string.txt')
      expect(stringContent).toBe('String content')
      
      const bufferContent = await sandbox.files.read('/tmp/concurrent-buffer.txt')
      expect(bufferContent).toBe('Buffer content')
      
      const arrayBufferContent = await sandbox.files.read('/tmp/concurrent-arraybuffer.txt')
      expect(arrayBufferContent).toBe('ArrayBuffer content')
      
      const blobContent = await sandbox.files.read('/tmp/concurrent-blob.txt')
      expect(blobContent).toBe('Blob content')
    }, timeout)
  })

  describe('Error Handling', () => {
    test('should handle invalid path for Buffer write', async () => {
      const buffer = Buffer.from('Test content')
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      
      await waitForSandboxHealth(sandbox)
      
      // Try to write to invalid path
      await expect(
        sandbox.files.write('', arrayBuffer)
      ).rejects.toThrow()
    }, timeout)

    test('should handle invalid path for ArrayBuffer write', async () => {
      const encoder = new TextEncoder()
      const arrayBuffer = encoder.encode('Test content').buffer
      
      await waitForSandboxHealth(sandbox)
      
      // Try to write to invalid path
      await expect(
        sandbox.files.write('', arrayBuffer)
      ).rejects.toThrow()
    }, timeout)

    test('should handle invalid path for Blob write', async () => {
      const blob = new Blob(['Test content'])
      
      await waitForSandboxHealth(sandbox)
      
      // Try to write to invalid path
      await expect(
        sandbox.files.write('', blob)
      ).rejects.toThrow()
    }, timeout)
  })
})

