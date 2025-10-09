import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { Sandbox } from '../../src'
import { template } from '../template'
import fs from 'fs'
import path from 'path'
import os from 'os'

const timeout = 60_000

// Backend saves uploaded files to /workspace with preserved directory structure
const BACKEND_WORKSPACE_PREFIX = '/workspace'

// Helper function to convert requested path to actual backend storage path
function getActualFilePath(requestedPath: string): string {
  return `${BACKEND_WORKSPACE_PREFIX}${requestedPath}`
}

// Health check function - now using the built-in waitForHealth method with 10s timeout
async function waitForSandboxHealth(sandbox: Sandbox) {
  await sandbox.waitForHealth({ timeout: 10_000 }) // 10 seconds timeout
}

describe('File Upload and Download', () => {
  let sandbox: Sandbox
  let tempDir: string
  let testFilePath: string
  let downloadPath: string

  beforeEach(async () => {
    // Create sandbox
    sandbox = await Sandbox.create(template, {
      timeoutMs: timeout,
    })

    // Create temporary directory and test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scalebox-test-'))
    testFilePath = path.join(tempDir, 'test-upload.txt')
    downloadPath = path.join(tempDir, 'test-download.txt')
    
    // Create test file
    fs.writeFileSync(testFilePath, 'Hello, Scalebox! This is a test file for upload/download functionality.')
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

  test('should upload file using uploadFile method', async () => {
    const remotePath = '/tmp/uploaded-test.txt'
    
    await waitForSandboxHealth(sandbox)
    
    const result = await sandbox.uploadFile(testFilePath, remotePath)
    
    expect(result.path).toBe(remotePath)
    expect(result.name).toBe('uploaded-test.txt')
    expect(result.type).toBe('file')
    
    // Verify file exists at actual storage location (backend saves to /workspace)
    const actualPath = getActualFilePath(remotePath)
    const actualDir = path.dirname(actualPath)
    
    const actualFiles = await sandbox.files.list(actualDir)
    const uploadedFile = actualFiles.find(file => file.name === 'uploaded-test.txt')
    
    expect(uploadedFile).toBeDefined()
    expect(uploadedFile!.name).toBe('uploaded-test.txt')
    expect(uploadedFile!.type).toBe('file')
    
    // Verify file properties via stat
    const fileInfo = await sandbox.files.stat(actualPath)
    expect(fileInfo.name).toBe('uploaded-test.txt')
    expect(fileInfo.type).toBe('file')
    expect(Number(fileInfo.size)).toBe(71)
  }, timeout)

  test('should download file using downloadFile method', async () => {
    const remotePath = '/tmp/test-for-download.txt'
    const testContent = 'This is a test file created in the sandbox for download testing.'
    
    await waitForSandboxHealth(sandbox)
    
    // Create file in sandbox first using write (also uses HTTP upload)
    await sandbox.files.write(remotePath, testContent)
    
    // Verify file was created at actual storage location (backend saves to /workspace)
    const actualPath = getActualFilePath(remotePath)
    const fileInfo = await sandbox.files.stat(actualPath)
    expect(fileInfo.name).toBe('test-for-download.txt')
    expect(fileInfo.type).toBe('file')
    
    // Download the file (should work with original path as downloadFile handles path resolution)
    const result = await sandbox.downloadFile(remotePath, downloadPath)
    
    expect(result.name).toBe('test-download.txt')
    expect(result.path).toBe(downloadPath)
    expect(result.size).toBeGreaterThan(0)
    
    // Verify downloaded file content
    const downloadedContent = fs.readFileSync(downloadPath, 'utf-8')
    expect(downloadedContent).toBe(testContent)
  }, timeout)

  test('should generate upload URL', async () => {
    const remotePath = '/tmp/upload-via-url.txt'
    
    const uploadUrl = await sandbox.uploadUrl(remotePath)
    
    expect(uploadUrl).toContain(sandbox.sandboxDomain)
    expect(uploadUrl).toContain('/upload')
    expect(uploadUrl).not.toContain('path=')
    expect(uploadUrl).not.toContain('username=')
  }, timeout)

  test('should generate download URL', async () => {
    const remotePath = '/tmp/download-via-url.txt'
    
    const downloadUrl = await sandbox.downloadUrl(remotePath)
    
    expect(downloadUrl).toContain(sandbox.sandboxDomain)
    expect(downloadUrl).toContain('/download/')
    expect(downloadUrl).toContain('tmp/download-via-url.txt') // Path should be in URL path, not query
    expect(downloadUrl).not.toContain('path=')
    expect(downloadUrl).not.toContain('username=')
  }, timeout)

  test('should generate URLs with custom user', async () => {
    const remotePath = '/tmp/custom-user-test.txt'
    const customUser = 'testuser'
    
    const uploadUrl = await sandbox.uploadUrl(remotePath, { user: customUser })
    const downloadUrl = await sandbox.downloadUrl(remotePath, { user: customUser })
    
    // URLs should be generated correctly regardless of user (auth is handled in headers)
    expect(uploadUrl).toContain(sandbox.sandboxDomain)
    expect(uploadUrl).toContain('/upload')
    expect(downloadUrl).toContain(sandbox.sandboxDomain)
    expect(downloadUrl).toContain('/download/')
  }, timeout)

  test('should upload and download binary file', async () => {
    // Health check before file operations
    await waitForSandboxHealth(sandbox)
    
    // Create a small binary file (PNG header)
    const binaryData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    ])
    
    const binaryFilePath = path.join(tempDir, 'test.png')
    const downloadBinaryPath = path.join(tempDir, 'downloaded.png')
    const remotePath = '/tmp/test-binary.png'
    
    fs.writeFileSync(binaryFilePath, binaryData)
    
    // Upload binary file
    await sandbox.uploadFile(binaryFilePath, remotePath)
    
    // Download binary file
    await sandbox.downloadFile(remotePath, downloadBinaryPath)
    
    // Verify binary content
    const originalData = fs.readFileSync(binaryFilePath)
    const downloadedData = fs.readFileSync(downloadBinaryPath)
    
    expect(Buffer.compare(originalData, downloadedData)).toBe(0)
  }, timeout)

  test('should handle file upload to nested directory', async () => {
    const remotePath = '/tmp/nested/dir/test-nested.txt'
    
    // Health check before file operations
    await waitForSandboxHealth(sandbox)
    
    const result = await sandbox.uploadFile(testFilePath, remotePath)
    
    expect(result.path).toBe(remotePath)
    
    // Verify file exists at actual storage location (backend saves to /workspace)
    const actualPath = getActualFilePath(remotePath)
    const actualDir = path.dirname(actualPath)
    
    const actualFiles = await sandbox.files.list(actualDir)
    const nestedFile = actualFiles.find(file => file.name === 'test-nested.txt')
    
    expect(nestedFile).toBeDefined()
    expect(nestedFile!.name).toBe('test-nested.txt')
    expect(nestedFile!.type).toBe('file')
    
    // Verify file properties via stat
    const fileInfo = await sandbox.files.stat(actualPath)
    expect(fileInfo.name).toBe('test-nested.txt')
    expect(fileInfo.type).toBe('file')
    
    // Verify directory structure was created
    const parentDir = path.dirname(actualDir)
    const parentFiles = await sandbox.files.list(parentDir)
    const dirEntry = parentFiles.find(entry => entry.name === 'dir' && entry.type === 'directory')
    expect(dirEntry).toBeDefined()
  }, timeout)

  test('should handle download to nested local directory', async () => {
    const remotePath = '/tmp/test-download-nested.txt'
    const nestedDownloadPath = path.join(tempDir, 'nested', 'dir', 'downloaded.txt')
    const testContent = 'Test content for nested download'
    
    // Health check before file operations
    await waitForSandboxHealth(sandbox)
    
    // Create file in sandbox
    await sandbox.files.write(remotePath, testContent)
    
    // Download to nested path (should create directories)
    const result = await sandbox.downloadFile(remotePath, nestedDownloadPath)
    
    expect(result.path).toBe(nestedDownloadPath)
    expect(fs.existsSync(nestedDownloadPath)).toBe(true)
    
    const content = fs.readFileSync(nestedDownloadPath, 'utf-8')
    expect(content).toBe(testContent)
  }, timeout)

  test('should handle large file upload and download', async () => {
    // Health check before file operations
    await waitForSandboxHealth(sandbox)
    
    // Create a larger test file (1MB)
    const largeContent = 'A'.repeat(1024 * 1024) // 1MB of 'A' characters
    const largeFilePath = path.join(tempDir, 'large-file.txt')
    const downloadLargePath = path.join(tempDir, 'large-downloaded.txt')
    const remotePath = '/tmp/large-file.txt'
    
    fs.writeFileSync(largeFilePath, largeContent)
    
    // Upload large file
    await sandbox.uploadFile(largeFilePath, remotePath)
    
    // Verify file exists at actual storage location (backend saves to /workspace)
    const actualPath = getActualFilePath(remotePath)
    const actualDir = path.dirname(actualPath)
    
    const actualFiles = await sandbox.files.list(actualDir)
    const largeFile = actualFiles.find(file => file.name === 'large-file.txt')
    
    expect(largeFile).toBeDefined()
    expect(largeFile!.name).toBe('large-file.txt')
    expect(largeFile!.type).toBe('file')
    expect(Number(largeFile!.size)).toBe(largeContent.length)
    
    // Download large file
    const result = await sandbox.downloadFile(remotePath, downloadLargePath)
    
    expect(result.size).toBe(largeContent.length)
    
    // Verify content (check first and last 100 characters to avoid memory issues)
    const downloadedContent = fs.readFileSync(downloadLargePath, 'utf-8')
    expect(downloadedContent.substring(0, 100)).toBe('A'.repeat(100))
    expect(downloadedContent.substring(downloadedContent.length - 100)).toBe('A'.repeat(100))
    expect(downloadedContent.length).toBe(largeContent.length)
  }, timeout * 2) // Double timeout for large file

  test('should throw error for non-existent local file upload', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.txt')
    const remotePath = '/tmp/should-fail.txt'
    
    // Health check before file operations
    await waitForSandboxHealth(sandbox)
    
    await expect(
      sandbox.uploadFile(nonExistentPath, remotePath)
    ).rejects.toThrow()
  }, timeout)

  test('should throw error for non-existent remote file download', async () => {
    const nonExistentRemotePath = '/tmp/does-not-exist.txt'

    // Health check before file operations
    await waitForSandboxHealth(sandbox)

    await expect(
      sandbox.downloadFile(nonExistentRemotePath, downloadPath)
    ).rejects.toThrow()
  }, timeout)
})
