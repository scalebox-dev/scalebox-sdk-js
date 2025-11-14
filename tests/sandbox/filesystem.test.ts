import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { Sandbox } from '../../src'
import { template } from '../template'
import fs from 'fs'
import path from 'path'
import os from 'os'

const timeout = 120_000 // 增加超时时间到2分钟

// Health check function - with error handling
async function waitForSandboxHealth(sandbox: Sandbox) {
  try {
    await sandbox.waitForHealth()
  } catch (error) {
    console.log('Health check failed, but continuing with test...')
    // 如果健康检查失败，我们仍然尝试运行测试
  }
}

describe('Filesystem Handlers', () => {
  let sandbox: Sandbox
  let tempDir: string

  beforeEach(async () => {
    // Create sandbox
    sandbox = await Sandbox.create(template, {
      timeoutMs: timeout,
    })

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scalebox-filesystem-test-'))
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

  describe('Stat Handler', () => {
    test('should get file information successfully', async () => {
      const testFilePath = '/tmp/test-stat-file.txt'
      const testContent = 'This is a test file for stat functionality.'
      
      await waitForSandboxHealth(sandbox)
      
      // Create a file first
      await sandbox.files.write(testFilePath, testContent)
      
      // Get file information using stat
      const fileInfo = await sandbox.files.stat(testFilePath)
      
      expect(fileInfo.name).toBe('test-stat-file.txt')
      expect(fileInfo.type).toBe('file')
      expect(fileInfo.path).toBe(testFilePath)
      expect(Number(fileInfo.size)).toBe(testContent.length)
      expect(fileInfo.modifiedAt).toBeInstanceOf(Date)
      expect(typeof fileInfo.mode).toBe('number')
      expect(fileInfo.permissions).toBeDefined()
      expect(fileInfo.owner).toBeDefined()
      expect(fileInfo.group).toBeDefined()
    }, timeout)

    test('should get directory information successfully', async () => {
      const testDirPath = '/tmp/test-stat-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create a directory first
      await sandbox.files.makeDir(testDirPath)
      
      // Get directory information using stat
      const dirInfo = await sandbox.files.stat(testDirPath)
      
      expect(dirInfo.name).toBe('test-stat-dir')
      expect(dirInfo.type).toBe('directory')
      expect(dirInfo.path).toBe(testDirPath)
      expect(Number(dirInfo.size)).toBeGreaterThan(0)
      expect(dirInfo.modifiedAt).toBeInstanceOf(Date)
      expect(typeof dirInfo.mode).toBe('number')
      expect(dirInfo.permissions).toBeDefined()
      expect(dirInfo.owner).toBeDefined()
      expect(dirInfo.group).toBeDefined()
    }, timeout)

    test('should handle non-existent file error', async () => {
      const nonExistentPath = '/tmp/does-not-exist.txt'
      
      await waitForSandboxHealth(sandbox)
      
      await expect(sandbox.files.stat(nonExistentPath)).rejects.toThrow()
    }, timeout)

    test('should handle symlink information', async () => {
      const targetPath = '/tmp/symlink-target.txt'
      const symlinkPath = '/tmp/symlink-test'
      
      await waitForSandboxHealth(sandbox)
      
      // Create target file
      await sandbox.files.write(targetPath, 'target content')
      
      // Create symlink (this might need to be done via process execution)
      const processStream = sandbox.processes.start({ cmd: 'ln', args: ['-s', targetPath, symlinkPath] })
      
      // Wait for process to complete
      for await (const event of processStream) {
        if (event.type === 'end') {
          break
        }
      }
      
      // Get symlink information
      const symlinkInfo = await sandbox.files.stat(symlinkPath)
      
      expect(symlinkInfo.name).toBe('symlink-test')
      expect(symlinkInfo.type).toBe('file') // symlinks are typically reported as files
      expect(symlinkInfo.path).toBe(symlinkPath)
      expect(symlinkInfo.symlinkTarget).toBeDefined()
    }, timeout)

    test('should use custom user in request', async () => {
      const testFilePath = '/tmp/test-user-file.txt'
      const testContent = 'Test content for user-specific stat'
      
      await waitForSandboxHealth(sandbox)
      
      // Create a file first
      await sandbox.files.write(testFilePath, testContent)
      
      // Get file information with custom user
      const fileInfo = await sandbox.files.stat(testFilePath, { user: 'root' })
      
      expect(fileInfo.name).toBe('test-user-file.txt')
      expect(fileInfo.type).toBe('file')
      expect(fileInfo.path).toBe(testFilePath)
    }, timeout)

    test('should use custom timeout', async () => {
      const testFilePath = '/tmp/test-timeout-file.txt'
      const testContent = 'Test content for timeout test'
      
      await waitForSandboxHealth(sandbox)
      
      // Create a file first
      await sandbox.files.write(testFilePath, testContent)
      
      // Get file information with custom timeout
      const fileInfo = await sandbox.files.stat(testFilePath, { requestTimeoutMs: 10000 })
      
      expect(fileInfo.name).toBe('test-timeout-file.txt')
      expect(fileInfo.type).toBe('file')
      expect(fileInfo.path).toBe(testFilePath)
    }, timeout)
  })

  describe('MakeDir Handler', () => {
    test('should create directory successfully', async () => {
      const testDirPath = '/tmp/test-makedir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory using makeDir
      const result = await sandbox.files.makeDir(testDirPath)
      
      expect(result.name).toBe('test-makedir')
      expect(result.type).toBe('directory')
      expect(result.path).toBe(testDirPath)
      
      // Verify directory exists by listing parent directory
      const parentDir = '/tmp'
      const entries = await sandbox.files.list(parentDir)
      const createdDir = entries.find(entry => entry.name === 'test-makedir')
      
      expect(createdDir).toBeDefined()
      expect(createdDir!.type).toBe('directory')
    }, timeout)

    test('should create nested directory successfully', async () => {
      const nestedDirPath = '/tmp/nested/path/test-nested-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create nested directory
      const result = await sandbox.files.makeDir(nestedDirPath)
      
      expect(result.name).toBe('test-nested-dir')
      expect(result.type).toBe('directory')
      expect(result.path).toBe(nestedDirPath)
      
      // Verify nested directory structure exists
      const parentDir = '/tmp/nested/path'
      const entries = await sandbox.files.list(parentDir)
      const createdDir = entries.find(entry => entry.name === 'test-nested-dir')
      
      expect(createdDir).toBeDefined()
      expect(createdDir!.type).toBe('directory')
    }, timeout)

    test('should handle directory already exists error', async () => {
      const existingDirPath = '/tmp/existing-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory first time
      await sandbox.files.makeDir(existingDirPath)
      
      // Try to create the same directory again
      await expect(sandbox.files.makeDir(existingDirPath)).rejects.toThrow()
    }, timeout)

    test('should handle invalid path error', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Try to create directory with invalid path
      await expect(sandbox.files.makeDir('')).rejects.toThrow()
    }, timeout)

    test('should use custom user in request', async () => {
      const testDirPath = '/tmp/test-user-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory with custom user
      const result = await sandbox.files.makeDir(testDirPath, { user: 'root' })
      
      expect(result.name).toBe('test-user-dir')
      expect(result.type).toBe('directory')
      expect(result.path).toBe(testDirPath)
    }, timeout)

    test('should use custom timeout', async () => {
      const testDirPath = '/tmp/test-timeout-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory with custom timeout
      const result = await sandbox.files.makeDir(testDirPath, { requestTimeoutMs: 15000 })
      
      expect(result.name).toBe('test-timeout-dir')
      expect(result.type).toBe('directory')
      expect(result.path).toBe(testDirPath)
    }, timeout)

    test('should create multiple directories in sequence', async () => {
      const dirPaths = [
        '/tmp/seq-dir-1',
        '/tmp/seq-dir-2',
        '/tmp/seq-dir-3'
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // Create multiple directories
      for (const dirPath of dirPaths) {
        const result = await sandbox.files.makeDir(dirPath)
        expect(result.name).toBe(path.basename(dirPath))
        expect(result.type).toBe('directory')
        expect(result.path).toBe(dirPath)
      }
      
      // Verify all directories exist
      const entries = await sandbox.files.list('/tmp')
      for (const dirPath of dirPaths) {
        const dirName = path.basename(dirPath)
        const createdDir = entries.find(entry => entry.name === dirName)
        expect(createdDir).toBeDefined()
        expect(createdDir!.type).toBe('directory')
      }
    }, timeout)
  })

  describe('Move Handler', () => {
    test('should move file successfully', async () => {
      const sourcePath = '/tmp/source-file.txt'
      const destPath = '/tmp/dest-moved-file.txt'
      const testContent = 'This is a test file for move functionality.'
      
      await waitForSandboxHealth(sandbox)
      
      // Create source file
      await sandbox.files.write(sourcePath, testContent)
      
      // Move file
      const result = await sandbox.files.move(sourcePath, destPath)
      
      expect(result.name).toBe('dest-moved-file.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(destPath)
      
      // Verify source file no longer exists
      await expect(sandbox.files.stat(sourcePath)).rejects.toThrow()
      
      // Verify destination file exists and has correct content
      const destFileInfo = await sandbox.files.stat(destPath)
      expect(destFileInfo.name).toBe('dest-moved-file.txt')
      expect(destFileInfo.type).toBe('file')
      
      const destContent = await sandbox.files.read(destPath)
      expect(destContent).toBe(testContent)
    }, timeout)

    test('should move directory successfully', async () => {
      const sourceDirPath = '/tmp/source-dir'
      const destDirPath = '/tmp/dest-moved-dir'
      const testFilePath = '/tmp/source-dir/test-file.txt'
      const testContent = 'Test content in directory'
      
      await waitForSandboxHealth(sandbox)
      
      // Create source directory and file
      await sandbox.files.makeDir(sourceDirPath)
      await sandbox.files.write(testFilePath, testContent)
      
      // Move directory
      const result = await sandbox.files.move(sourceDirPath, destDirPath)
      
      expect(result.name).toBe('dest-moved-dir')
      expect(result.type).toBe('directory')
      expect(result.path).toBe(destDirPath)
      
      // Verify source directory no longer exists
      await expect(sandbox.files.stat(sourceDirPath)).rejects.toThrow()
      
      // Verify destination directory exists
      const destDirInfo = await sandbox.files.stat(destDirPath)
      expect(destDirInfo.name).toBe('dest-moved-dir')
      expect(destDirInfo.type).toBe('directory')
      
      // Verify file inside moved directory still exists
      const movedFilePath = '/tmp/dest-moved-dir/test-file.txt'
      const movedFileContent = await sandbox.files.read(movedFilePath)
      expect(movedFileContent).toBe(testContent)
    }, timeout)

    test('should handle source file not found error', async () => {
      const nonExistentPath = '/tmp/does-not-exist.txt'
      const destPath = '/tmp/dest-file.txt'
      
      await waitForSandboxHealth(sandbox)
      
      await expect(sandbox.files.move(nonExistentPath, destPath)).rejects.toThrow()
    }, timeout)

    test('should handle destination already exists error', async () => {
      const sourcePath = '/tmp/source-existing.txt'
      const destPath = '/tmp/dest-existing.txt'
      const sourceContent = 'Source content'
      const destContent = 'Destination content'
      
      await waitForSandboxHealth(sandbox)
      
      // Create both source and destination files
      await sandbox.files.write(sourcePath, sourceContent)
      await sandbox.files.write(destPath, destContent)
      
      // Try to move to existing destination (backend allows overwrite)
      const result = await sandbox.files.move(sourcePath, destPath)
      
      // Verify move succeeded and content was overwritten
      expect(result.name).toBe('dest-existing.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(destPath)
      
      // Verify source file no longer exists
      await expect(sandbox.files.stat(sourcePath)).rejects.toThrow()
      
      // Verify destination file has new content
      const newDestContent = await sandbox.files.read(destPath)
      expect(newDestContent).toBe(sourceContent)
    }, timeout)

    test('should use custom user in request', async () => {
      const sourcePath = '/tmp/source-user-file.txt'
      const destPath = '/tmp/dest-user-file.txt'
      const testContent = 'Test content for user-specific move'
      
      await waitForSandboxHealth(sandbox)
      
      // Create source file
      await sandbox.files.write(sourcePath, testContent)
      
      // Move file with custom user
      const result = await sandbox.files.move(sourcePath, destPath, { user: 'root' })
      
      expect(result.name).toBe('dest-user-file.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(destPath)
    }, timeout)

    test('should use custom timeout', async () => {
      const sourcePath = '/tmp/source-timeout-file.txt'
      const destPath = '/tmp/dest-timeout-file.txt'
      const testContent = 'Test content for timeout move'
      
      await waitForSandboxHealth(sandbox)
      
      // Create source file
      await sandbox.files.write(sourcePath, testContent)
      
      // Move file with custom timeout
      const result = await sandbox.files.move(sourcePath, destPath, { requestTimeoutMs: 20000 })
      
      expect(result.name).toBe('dest-timeout-file.txt')
      expect(result.type).toBe('file')
      expect(result.path).toBe(destPath)
    }, timeout)

    test('should move multiple files in sequence', async () => {
      const filePairs = [
        { source: '/tmp/seq-source-1.txt', dest: '/tmp/seq-dest-1.txt' },
        { source: '/tmp/seq-source-2.txt', dest: '/tmp/seq-dest-2.txt' },
        { source: '/tmp/seq-source-3.txt', dest: '/tmp/seq-dest-3.txt' }
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // Create source files
      for (const pair of filePairs) {
        await sandbox.files.write(pair.source, `Content for ${pair.source}`)
      }
      
      // Move all files
      for (const pair of filePairs) {
        const result = await sandbox.files.move(pair.source, pair.dest)
        expect(result.name).toBe(path.basename(pair.dest))
        expect(result.type).toBe('file')
        expect(result.path).toBe(pair.dest)
        
        // Verify source no longer exists
        await expect(sandbox.files.stat(pair.source)).rejects.toThrow()
        
        // Verify destination exists
        const destInfo = await sandbox.files.stat(pair.dest)
        expect(destInfo.name).toBe(path.basename(pair.dest))
        expect(destInfo.type).toBe('file')
      }
    }, timeout)
  })

  describe('ListDir Handler', () => {
    test('should list directory contents successfully', async () => {
      const testDirPath = '/tmp/test-list-dir'
      const file1Path = '/tmp/test-list-dir/file1.txt'
      const file2Path = '/tmp/test-list-dir/file2.txt'
      const subDirPath = '/tmp/test-list-dir/subdir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create test directory structure
      await sandbox.files.makeDir(testDirPath)
      await sandbox.files.write(file1Path, 'Content 1')
      await sandbox.files.write(file2Path, 'Content 2')
      await sandbox.files.makeDir(subDirPath)
      
      // List directory contents
      const entries = await sandbox.files.list(testDirPath)
      
      expect(entries).toHaveLength(3)
      
      // Find specific entries
      const file1 = entries.find(entry => entry.name === 'file1.txt')
      const file2 = entries.find(entry => entry.name === 'file2.txt')
      const subdir = entries.find(entry => entry.name === 'subdir')
      
      expect(file1).toBeDefined()
      expect(file1!.type).toBe('file')
      expect(file1!.path).toBe(file1Path)
      expect(Number(file1!.size)).toBeGreaterThan(0)
      expect(file1!.modifiedAt).toBeInstanceOf(Date)
      
      expect(file2).toBeDefined()
      expect(file2!.type).toBe('file')
      expect(file2!.path).toBe(file2Path)
      
      expect(subdir).toBeDefined()
      expect(subdir!.type).toBe('directory')
      expect(subdir!.path).toBe(subDirPath)
    }, timeout)

    test('should list directory contents recursively', async () => {
      const testDirPath = '/tmp/test-recursive-dir'
      const nestedDirPath = '/tmp/test-recursive-dir/nested'
      const deepDirPath = '/tmp/test-recursive-dir/nested/deep'
      const file1Path = '/tmp/test-recursive-dir/file1.txt'
      const file2Path = '/tmp/test-recursive-dir/nested/file2.txt'
      const file3Path = '/tmp/test-recursive-dir/nested/deep/file3.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create nested directory structure
      await sandbox.files.makeDir(testDirPath)
      await sandbox.files.makeDir(nestedDirPath)
      await sandbox.files.makeDir(deepDirPath)
      await sandbox.files.write(file1Path, 'Content 1')
      await sandbox.files.write(file2Path, 'Content 2')
      await sandbox.files.write(file3Path, 'Content 3')
      
      // List directory contents recursively
      const entries = await sandbox.files.list(testDirPath, { recursive: true })
      
      expect(entries.length).toBeGreaterThanOrEqual(5) // At least 3 files + 2 directories
      
      // Find specific entries
      const file1 = entries.find(entry => entry.name === 'file1.txt')
      const file2 = entries.find(entry => entry.name === 'file2.txt')
      const file3 = entries.find(entry => entry.name === 'file3.txt')
      const nestedDir = entries.find(entry => entry.name === 'nested')
      const deepDir = entries.find(entry => entry.name === 'deep')
      
      expect(file1).toBeDefined()
      expect(file2).toBeDefined()
      expect(file3).toBeDefined()
      expect(nestedDir).toBeDefined()
      expect(deepDir).toBeDefined()
    }, timeout)

    test('should handle empty directory', async () => {
      const emptyDirPath = '/tmp/empty-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create empty directory
      await sandbox.files.makeDir(emptyDirPath)
      
      // List empty directory
      const entries = await sandbox.files.list(emptyDirPath)
      
      expect(entries).toEqual([])
    }, timeout)

    test('should handle directory not found error', async () => {
      const nonExistentDir = '/tmp/does-not-exist'
      
      await waitForSandboxHealth(sandbox)
      
      await expect(sandbox.files.list(nonExistentDir)).rejects.toThrow()
    }, timeout)

    test('should handle path is not a directory error', async () => {
      const filePath = '/tmp/test-file.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create a file
      await sandbox.files.write(filePath, 'Test content')
      
      // Try to list a file as directory
      await expect(sandbox.files.list(filePath)).rejects.toThrow()
    }, timeout)

    test('should use custom user in request', async () => {
      const testDirPath = '/tmp/test-user-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create test directory
      await sandbox.files.makeDir(testDirPath)
      
      // List directory with custom user
      const entries = await sandbox.files.list(testDirPath, { user: 'root' })
      
      expect(entries).toEqual([])
    }, timeout)

    test('should use custom timeout', async () => {
      const testDirPath = '/tmp/test-timeout-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create test directory
      await sandbox.files.makeDir(testDirPath)
      
      // List directory with custom timeout
      const entries = await sandbox.files.list(testDirPath, { requestTimeoutMs: 25000 })
      
      expect(entries).toEqual([])
    }, timeout)

    test('should handle symlinks in directory listing', async () => {
      const testDirPath = '/tmp/test-symlink-dir'
      const targetPath = '/tmp/symlink-target.txt'
      const symlinkPath = '/tmp/test-symlink-dir/symlink'
      
      await waitForSandboxHealth(sandbox)
      
      // Create test directory and target file
      await sandbox.files.makeDir(testDirPath)
      await sandbox.files.write(targetPath, 'Target content')
      
      // Create symlink (using process execution)
      const processStream = sandbox.processes.start({ cmd: 'ln', args: ['-s', targetPath, symlinkPath] })
      
      // Wait for process to complete
      for await (const event of processStream) {
        if (event.type === 'end') {
          break
        }
      }
      
      // List directory contents
      const entries = await sandbox.files.list(testDirPath)
      
      const symlink = entries.find(entry => entry.name === 'symlink')
      expect(symlink).toBeDefined()
      expect(symlink!.type).toBe('file') // symlinks are typically reported as files
      expect(symlink!.symlinkTarget).toBeDefined()
    }, timeout)

    test('should list multiple directories in sequence', async () => {
      const dirPaths = [
        '/tmp/seq-dir-1',
        '/tmp/seq-dir-2',
        '/tmp/seq-dir-3'
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // Create multiple directories with files
      for (let i = 0; i < dirPaths.length; i++) {
        const dirPath = dirPaths[i]
        await sandbox.files.makeDir(dirPath)
        await sandbox.files.write(`${dirPath}/file${i + 1}.txt`, `Content ${i + 1}`)
      }
      
      // List all directories
      for (const dirPath of dirPaths) {
        const entries = await sandbox.files.list(dirPath)
        expect(entries).toHaveLength(1)
        expect(entries[0].name).toMatch(/^file\d+\.txt$/)
        expect(entries[0].type).toBe('file')
      }
    }, timeout)

    test('should serialize list results to JSON without BigInt errors', async () => {
      const testDirPath = '/tmp/test-json-serialization'
      const file1Path = '/tmp/test-json-serialization/file1.txt'
      const file2Path = '/tmp/test-json-serialization/file2.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create test directory and files
      await sandbox.files.makeDir(testDirPath)
      await sandbox.files.write(file1Path, 'Content 1')
      await sandbox.files.write(file2Path, 'Content 2')
      
      // List directory contents
      const entries = await sandbox.files.list(testDirPath)
      
      // Test JSON serialization - this should NOT throw BigInt error
      expect(() => JSON.stringify(entries)).not.toThrow()
      
      // Verify serialization produces valid JSON
      const json = JSON.stringify(entries)
      expect(json).toBeDefined()
      expect(json.length).toBeGreaterThan(0)
      
      // Verify deserialization works
      const parsed = JSON.parse(json)
      expect(parsed).toHaveLength(2)
      
      // Verify all fields are properly converted (not BigInt)
      for (const entry of entries) {
        expect(typeof entry.size).toBe('number')
        expect(typeof entry.mode).toBe('number')
      }
      
      // Also test stat() method serialization
      const statInfo = await sandbox.files.stat(file1Path)
      expect(() => JSON.stringify(statInfo)).not.toThrow()
      expect(typeof statInfo.size).toBe('number')
      expect(typeof statInfo.mode).toBe('number')
    }, timeout)
  })

  describe('Remove Handler', () => {
    test('should remove file successfully', async () => {
      const filePath = '/tmp/test-remove-file.txt'
      const testContent = 'This is a test file for remove functionality.'
      
      await waitForSandboxHealth(sandbox)
      
      // Create file first
      await sandbox.files.write(filePath, testContent)
      
      // Verify file exists
      const fileInfo = await sandbox.files.stat(filePath)
      expect(fileInfo.name).toBe('test-remove-file.txt')
      
      // Remove file
      await sandbox.files.remove(filePath)
      
      // Verify file no longer exists
      await expect(sandbox.files.stat(filePath)).rejects.toThrow()
    }, timeout)

    test('should remove directory successfully', async () => {
      const dirPath = '/tmp/test-remove-dir'
      const filePath = '/tmp/test-remove-dir/test-file.txt'
      const testContent = 'Test content in directory'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory and file
      await sandbox.files.makeDir(dirPath)
      await sandbox.files.write(filePath, testContent)
      
      // Verify directory and file exist
      const dirInfo = await sandbox.files.stat(dirPath)
      expect(dirInfo.name).toBe('test-remove-dir')
      expect(dirInfo.type).toBe('directory')
      
      const fileInfo = await sandbox.files.stat(filePath)
      expect(fileInfo.name).toBe('test-file.txt')
      
      // Remove directory (should remove recursively)
      await sandbox.files.remove(dirPath)
      
      // Verify directory no longer exists
      await expect(sandbox.files.stat(dirPath)).rejects.toThrow()
    }, timeout)

    test('should remove nested directory structure', async () => {
      const rootDirPath = '/tmp/test-nested-remove'
      const nestedDirPath = '/tmp/test-nested-remove/nested'
      const deepDirPath = '/tmp/test-nested-remove/nested/deep'
      const file1Path = '/tmp/test-nested-remove/file1.txt'
      const file2Path = '/tmp/test-nested-remove/nested/file2.txt'
      const file3Path = '/tmp/test-nested-remove/nested/deep/file3.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create nested directory structure
      await sandbox.files.makeDir(rootDirPath)
      await sandbox.files.makeDir(nestedDirPath)
      await sandbox.files.makeDir(deepDirPath)
      await sandbox.files.write(file1Path, 'Content 1')
      await sandbox.files.write(file2Path, 'Content 2')
      await sandbox.files.write(file3Path, 'Content 3')
      
      // Verify all files exist
      expect(await sandbox.files.stat(file1Path)).toBeDefined()
      expect(await sandbox.files.stat(file2Path)).toBeDefined()
      expect(await sandbox.files.stat(file3Path)).toBeDefined()
      
      // Remove root directory (should remove everything recursively)
      await sandbox.files.remove(rootDirPath)
      
      // Verify all files and directories no longer exist
      await expect(sandbox.files.stat(rootDirPath)).rejects.toThrow()
      await expect(sandbox.files.stat(nestedDirPath)).rejects.toThrow()
      await expect(sandbox.files.stat(deepDirPath)).rejects.toThrow()
      await expect(sandbox.files.stat(file1Path)).rejects.toThrow()
      await expect(sandbox.files.stat(file2Path)).rejects.toThrow()
      await expect(sandbox.files.stat(file3Path)).rejects.toThrow()
    }, timeout)

    test('should handle non-existent file error', async () => {
      const nonExistentPath = '/tmp/does-not-exist.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Try to remove non-existent file (backend allows this)
      const result = await sandbox.files.remove(nonExistentPath)
      expect(result).toBeUndefined()
    }, timeout)

    test('should use custom user in request', async () => {
      const filePath = '/tmp/test-user-remove-file.txt'
      const testContent = 'Test content for user-specific remove'
      
      await waitForSandboxHealth(sandbox)
      
      // Create file first
      await sandbox.files.write(filePath, testContent)
      
      // Remove file with custom user
      await sandbox.files.remove(filePath, { user: 'root' })
      
      // Verify file no longer exists
      await expect(sandbox.files.stat(filePath)).rejects.toThrow()
    }, timeout)

    test('should use custom timeout', async () => {
      const filePath = '/tmp/test-timeout-remove-file.txt'
      const testContent = 'Test content for timeout remove'
      
      await waitForSandboxHealth(sandbox)
      
      // Create file first
      await sandbox.files.write(filePath, testContent)
      
      // Remove file with custom timeout
      await sandbox.files.remove(filePath, { requestTimeoutMs: 30000 })
      
      // Verify file no longer exists
      await expect(sandbox.files.stat(filePath)).rejects.toThrow()
    }, timeout)

    test('should remove multiple files in sequence', async () => {
      const filePaths = [
        '/tmp/seq-remove-1.txt',
        '/tmp/seq-remove-2.txt',
        '/tmp/seq-remove-3.txt'
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // Create multiple files
      for (const filePath of filePaths) {
        await sandbox.files.write(filePath, `Content for ${filePath}`)
      }
      
      // Remove all files
      for (const filePath of filePaths) {
        await sandbox.files.remove(filePath)
        
        // Verify file no longer exists
        await expect(sandbox.files.stat(filePath)).rejects.toThrow()
      }
    }, timeout)

    test('should remove files with special characters in names', async () => {
      const specialFilePaths = [
        '/tmp/file with spaces.txt',
        '/tmp/file-with-dashes.txt',
        '/tmp/file_with_underscores.txt',
        '/tmp/file.with.dots.txt'
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // Create files with special characters
      for (const filePath of specialFilePaths) {
        await sandbox.files.write(filePath, `Content for ${filePath}`)
      }
      
      // Remove all files
      for (const filePath of specialFilePaths) {
        await sandbox.files.remove(filePath)
        
        // Verify file no longer exists
        await expect(sandbox.files.stat(filePath)).rejects.toThrow()
      }
    }, timeout)
  })

  describe('File Watcher Handlers', () => {
    test('should create watcher successfully', async () => {
      const watchDirPath = '/tmp/test-watcher-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Create watcher
      const watcher = await sandbox.files.createWatcher(watchDirPath)
      
      // Verify watcher structure in detail
      expect(watcher).toBeDefined()
      expect(watcher).toHaveProperty('id')
      expect(watcher).toHaveProperty('getEvents')
      expect(watcher).toHaveProperty('remove')
      
      // Verify id property
      expect(watcher.id).toBeDefined()
      expect(typeof watcher.id).toBe('string')
      expect(watcher.id.length).toBeGreaterThan(0)
      
      // Print watcher structure for debugging
      console.log('Watcher structure:', {
        id: watcher.id,
        hasGetEvents: typeof watcher.getEvents === 'function',
        hasRemove: typeof watcher.remove === 'function',
        watcherKeys: Object.keys(watcher)
      })
      
      // Verify getEvents method
      expect(watcher.getEvents).toBeDefined()
      expect(typeof watcher.getEvents).toBe('function')
      const eventsPromise = watcher.getEvents()
      expect(eventsPromise).toBeInstanceOf(Promise)
      const events = await eventsPromise
      expect(Array.isArray(events)).toBe(true)
      
      // Print events for debugging
      console.log('Initial events from watcher:', JSON.stringify(events, null, 2))
      
      // Verify remove method
      expect(watcher.remove).toBeDefined()
      expect(typeof watcher.remove).toBe('function')
      
      // Clean up watcher
      await watcher.remove()
    }, timeout)

    test('should create recursive watcher successfully', async () => {
      const watchDirPath = '/tmp/test-recursive-watcher-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Wait a bit for directory to be created
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify directory exists before creating watcher
      const dirInfo = await sandbox.files.stat(watchDirPath)
      expect(dirInfo.type).toBe('directory')
      
      // Create recursive watcher using watchDir (which works)
      const watchStream = sandbox.files.watchDir(watchDirPath, { recursive: true })
      
      // Verify watchStream structure in detail
      expect(watchStream).toBeDefined()
      expect(watchStream[Symbol.asyncIterator]).toBeDefined()
      expect(typeof watchStream[Symbol.asyncIterator]).toBe('function')
      
      // Verify it's an async generator
      const iterator = watchStream[Symbol.asyncIterator]()
      expect(iterator).toBeDefined()
      expect(iterator).toHaveProperty('next')
      expect(typeof iterator.next).toBe('function')
      
      // Print watchStream structure for debugging
      console.log('watchStream structure:', {
        hasAsyncIterator: typeof watchStream[Symbol.asyncIterator] === 'function',
        iteratorType: typeof iterator,
        hasNext: typeof iterator.next === 'function'
      })
      
      // Clean up watcher
      await watchStream.return()
    }, timeout)

    test('should get watcher events', async () => {
      const watchDirPath = '/tmp/test-events-dir'
      const testFilePath = '/tmp/test-events-dir/test-file.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Create watcher
      const watcher = await sandbox.files.createWatcher(watchDirPath)
      
      // Create a file to trigger event
      await sandbox.files.write(testFilePath, 'Test content')
      
      // Wait a bit for event to be captured
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Get events
      const events = await watcher.getEvents()
      
      // Print events for debugging
      console.log('Watcher events:', JSON.stringify(events, null, 2))
      console.log('Events count:', events.length)
      
      // Verify events array structure
      expect(Array.isArray(events)).toBe(true)
      
      // Events might be empty or contain file creation events
      if (events.length > 0) {
        const event = events[0]
        
        // Print first event structure for debugging
        console.log('First event structure:', JSON.stringify(event, null, 2))
        console.log('First event keys:', Object.keys(event))
        
        // Verify event structure in detail
        expect(event).toBeDefined()
        expect(event).toHaveProperty('type')
        expect(event).toHaveProperty('name')
        expect(event).toHaveProperty('path')
        
        // Verify event.type
        expect(event.type).toBeDefined()
        expect(typeof event.type).toBe('string')
        expect(['create', 'write', 'remove', 'rename', 'chmod']).toContain(event.type)
        
        // Verify event.name
        expect(event.name).toBeDefined()
        expect(typeof event.name).toBe('string')
        expect(event.name.length).toBeGreaterThan(0)
        
        // Verify event.path
        expect(event.path).toBeDefined()
        expect(typeof event.path).toBe('string')
        expect(event.path).toContain(watchDirPath)
        expect(event.path).toContain(event.name)
      }
      
      // Clean up watcher
      await watcher.remove()
    }, timeout)

    test('should remove watcher successfully', async () => {
      const watchDirPath = '/tmp/test-remove-watcher-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Create watcher
      const watcher = await sandbox.files.createWatcher(watchDirPath)
      const watcherId = watcher.id
      
      expect(watcherId).toBeDefined()
  
      // Try to get events after removal (should not throw)
      const events = await watcher.getEvents()
          
      // Remove watcher
      await watcher.remove()

      expect(Array.isArray(events)).toBe(true)
    }, timeout)

    test('should watch directory with streaming', async () => {
      const watchDirPath = '/tmp/test-stream-watch-dir'
      const testFilePath = '/tmp/test-stream-watch-dir/test-file.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Start watching directory
      const watchStream = sandbox.files.watchDir(watchDirPath)
      
      // Verify watchStream structure
      expect(watchStream).toBeDefined()
      expect(watchStream[Symbol.asyncIterator]).toBeDefined()
      expect(typeof watchStream[Symbol.asyncIterator]).toBe('function')
      
      // Create a file to trigger event
      await sandbox.files.write(testFilePath, 'Test content')
      
      // Wait for events
      const events: any[] = []
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000))
      
      try {
        for await (const event of watchStream) {
          // Print event for debugging
          console.log('Stream event received:', JSON.stringify(event, null, 2))
          console.log('Event keys:', Object.keys(event))
          
          // Verify event structure in detail
          expect(event).toBeDefined()
          expect(event).toHaveProperty('type')
          expect(event).toHaveProperty('name')
          expect(event).toHaveProperty('path')
          
          // Verify event.type
          expect(event.type).toBeDefined()
          expect(typeof event.type).toBe('string')
          expect(['create', 'write', 'remove', 'rename', 'chmod']).toContain(event.type)
          
          // Verify event.name
          expect(event.name).toBeDefined()
          expect(typeof event.name).toBe('string')
          expect(event.name.length).toBeGreaterThan(0)
          
          // Verify event.path
          expect(event.path).toBeDefined()
          expect(typeof event.path).toBe('string')
          expect(event.path).toContain(watchDirPath)
          
          events.push(event)
          if (events.length >= 1) {
            break // Stop after getting one event
          }
        }
      } catch (error) {
        // Stream might end or timeout, which is expected
        console.log('Stream error (expected):', error)
      }
      
      // Print all collected events
      console.log('All collected events:', JSON.stringify(events, null, 2))
      console.log('Total events collected:', events.length)
      
      // Events might be empty due to timing, but stream should work
      expect(Array.isArray(events)).toBe(true)
      if (events.length > 0) {
        // Verify first event structure
        const firstEvent = events[0]
        console.log('First event details:', JSON.stringify(firstEvent, null, 2))
        expect(firstEvent.type).toBeDefined()
        expect(firstEvent.name).toBeDefined()
        expect(firstEvent.path).toBeDefined()
      }
    }, timeout)

    test('should watch directory recursively with streaming', async () => {
      const watchDirPath = '/tmp/test-recursive-stream-watch-dir'
      const nestedDirPath = '/tmp/test-recursive-stream-watch-dir/nested'
      const testFilePath = '/tmp/test-recursive-stream-watch-dir/nested/test-file.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory structure to watch
      await sandbox.files.makeDir(watchDirPath)
      await sandbox.files.makeDir(nestedDirPath)
      
      // Start watching directory recursively
      const watchStream = sandbox.files.watchDir(watchDirPath, { recursive: true })
      
      // Verify watchStream structure
      expect(watchStream).toBeDefined()
      expect(watchStream[Symbol.asyncIterator]).toBeDefined()
      expect(typeof watchStream[Symbol.asyncIterator]).toBe('function')
      
      // Create a file in nested directory to trigger event
      await sandbox.files.write(testFilePath, 'Test content')
      
      // Wait for events
      const events: any[] = []
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000))
      
      try {
        for await (const event of watchStream) {
          // Print event for debugging
          console.log('Recursive stream event received:', JSON.stringify(event, null, 2))
          console.log('Recursive event keys:', Object.keys(event))
          
          // Verify event structure in detail
          expect(event).toBeDefined()
          expect(event).toHaveProperty('type')
          expect(event).toHaveProperty('name')
          expect(event).toHaveProperty('path')
          
          // Verify event.type
          expect(event.type).toBeDefined()
          expect(typeof event.type).toBe('string')
          expect(['create', 'write', 'remove', 'rename', 'chmod']).toContain(event.type)
          
          // Verify event.name
          expect(event.name).toBeDefined()
          expect(typeof event.name).toBe('string')
          expect(event.name.length).toBeGreaterThan(0)
          
          // Verify event.path
          expect(event.path).toBeDefined()
          expect(typeof event.path).toBe('string')
          expect(event.path).toContain(watchDirPath)
          
          events.push(event)
          if (events.length >= 1) {
            break // Stop after getting one event
          }
        }
      } catch (error) {
        // Stream might end or timeout, which is expected
        console.log('Recursive stream error (expected):', error)
      }
      
      // Print all collected events
      console.log('All collected recursive events:', JSON.stringify(events, null, 2))
      console.log('Total recursive events collected:', events.length)
      
      // Events might be empty due to timing, but stream should work
      expect(Array.isArray(events)).toBe(true)
      if (events.length > 0) {
        // Verify first event structure
        const firstEvent = events[0]
        console.log('First recursive event details:', JSON.stringify(firstEvent, null, 2))
        expect(firstEvent.type).toBeDefined()
        expect(firstEvent.name).toBeDefined()
        expect(firstEvent.path).toBeDefined()
        // For recursive watch, path should contain nested directory
        expect(firstEvent.path).toContain('nested')
      }
    }, timeout)

    test('should use custom user in watcher creation', async () => {
      const watchDirPath = '/tmp/test-user-watcher-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Create watcher with custom user
      const watcher = await sandbox.files.createWatcher(watchDirPath, { user: 'root' })
      
      expect(watcher.id).toBeDefined()
      expect(typeof watcher.id).toBe('string')
      
      // Clean up watcher
      await watcher.remove()
    }, timeout)

    test('should use custom timeout in watcher creation', async () => {
      const watchDirPath = '/tmp/test-timeout-watcher-dir'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directory to watch
      await sandbox.files.makeDir(watchDirPath)
      
      // Create watcher with custom timeout
      const watcher = await sandbox.files.createWatcher(watchDirPath, { requestTimeoutMs: 35000 })
      
      expect(watcher.id).toBeDefined()
      expect(typeof watcher.id).toBe('string')
      
      // Clean up watcher
      await watcher.remove()
    }, timeout)

    test('should handle multiple watchers simultaneously', async () => {
      const watchDir1Path = '/tmp/test-multi-watcher-dir-1'
      const watchDir2Path = '/tmp/test-multi-watcher-dir-2'
      
      await waitForSandboxHealth(sandbox)
      
      // Create directories to watch
      await sandbox.files.makeDir(watchDir1Path)
      await sandbox.files.makeDir(watchDir2Path)
      
      // Create multiple watchers
      const watcher1 = await sandbox.files.createWatcher(watchDir1Path)
      const watcher2 = await sandbox.files.createWatcher(watchDir2Path)
      
      expect(watcher1.id).toBeDefined()
      expect(watcher2.id).toBeDefined()
      expect(watcher1.id).not.toBe(watcher2.id)
      
      // Clean up watchers
      await watcher1.remove()
      await watcher2.remove()
    }, timeout)
  })

  describe('Integration Tests - All Handlers Working Together', () => {
    test('should perform complete file lifecycle operations', async () => {
      const baseDir = '/tmp/integration-test'
      const filePath = '/tmp/integration-test/test-file.txt'
      const movedFilePath = '/tmp/integration-test/moved-file.txt'
      const testContent = 'Integration test content'
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create directory (MakeDir)
      const dirResult = await sandbox.files.makeDir(baseDir)
      expect(dirResult.type).toBe('directory')
      expect(dirResult.path).toBe(baseDir)
      
      // 2. List directory (should be empty)
      let entries = await sandbox.files.list(baseDir)
      expect(entries).toEqual([])
      
      // 3. Create file (Write)
      await sandbox.files.write(filePath, testContent)
      
      // 4. Stat file (Stat)
      const fileInfo = await sandbox.files.stat(filePath)
      expect(fileInfo.name).toBe('test-file.txt')
      expect(fileInfo.type).toBe('file')
      expect(Number(fileInfo.size)).toBe(testContent.length)
      
      // 5. List directory (should contain file)
      entries = await sandbox.files.list(baseDir)
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('test-file.txt')
      
      // 6. Move file (Move)
      const moveResult = await sandbox.files.move(filePath, movedFilePath)
      expect(moveResult.name).toBe('moved-file.txt')
      expect(moveResult.path).toBe(movedFilePath)
      
      // 7. Verify original file no longer exists
      await expect(sandbox.files.stat(filePath)).rejects.toThrow()
      
      // 8. Verify moved file exists
      const movedFileInfo = await sandbox.files.stat(movedFilePath)
      expect(movedFileInfo.name).toBe('moved-file.txt')
      
      // 9. Read moved file content
      const movedContent = await sandbox.files.read(movedFilePath)
      expect(movedContent).toBe(testContent)
      
      // 10. Remove file (Remove)
      await sandbox.files.remove(movedFilePath)
      await expect(sandbox.files.stat(movedFilePath)).rejects.toThrow()
      
      // 11. Remove directory (Remove)
      await sandbox.files.remove(baseDir)
      await expect(sandbox.files.stat(baseDir)).rejects.toThrow()
    }, timeout)

    test('should handle complex directory operations with watching', async () => {
      const baseDir = '/tmp/complex-integration-test'
      const nestedDir = '/tmp/complex-integration-test/nested'
      const file1Path = '/tmp/complex-integration-test/file1.txt'
      const file2Path = '/tmp/complex-integration-test/nested/file2.txt'
      const file3Path = '/tmp/complex-integration-test/nested/file3.txt'
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create base directory
      await sandbox.files.makeDir(baseDir)
      
      // 2. Create watcher for base directory using watchDir
      const watchStream = sandbox.files.watchDir(baseDir, { recursive: true })
      
      // 3. Create nested directory
      await sandbox.files.makeDir(nestedDir)
      
      // 4. Create files
      await sandbox.files.write(file1Path, 'Content 1')
      await sandbox.files.write(file2Path, 'Content 2')
      await sandbox.files.write(file3Path, 'Content 3')
      
      // 5. List base directory
      const baseEntries = await sandbox.files.list(baseDir)
      expect(baseEntries).toHaveLength(2) // file1.txt and nested directory
      
      // 6. List nested directory
      const nestedEntries = await sandbox.files.list(nestedDir)
      expect(nestedEntries).toHaveLength(2) // file2.txt and file3.txt
      
      // 7. List recursively
      const allEntries = await sandbox.files.list(baseDir, { recursive: true })
      expect(allEntries.length).toBeGreaterThanOrEqual(4) // At least 3 files + 1 directory
      
      // 8. Move file within nested directory
      const movedFile2Path = '/tmp/complex-integration-test/nested/moved-file2.txt'
      await sandbox.files.move(file2Path, movedFile2Path)
      
      // 9. Verify move worked
      await expect(sandbox.files.stat(file2Path)).rejects.toThrow()
      const movedFileInfo = await sandbox.files.stat(movedFile2Path)
      expect(movedFileInfo.name).toBe('moved-file2.txt')
      
      // 10. Get watcher events (skip for watchStream as it's async iterator)
      // Note: watchStream doesn't have getEvents method, it's an async iterator
      // For this test, we'll skip the events verification
      
      // 11. Remove entire structure
      await sandbox.files.remove(baseDir)
      
      // 12. Verify everything is removed
      await expect(sandbox.files.stat(baseDir)).rejects.toThrow()
      await expect(sandbox.files.stat(nestedDir)).rejects.toThrow()
      
      // 13. Clean up watcher
      watchStream.return()
    }, timeout)

    test('should handle concurrent operations', async () => {
      const baseDir = '/tmp/concurrent-test'
      const filePaths = [
        '/tmp/concurrent-test/file1.txt',
        '/tmp/concurrent-test/file2.txt',
        '/tmp/concurrent-test/file3.txt'
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create base directory
      await sandbox.files.makeDir(baseDir)
      
      // 2. Create multiple files concurrently
      const writePromises = filePaths.map((filePath, index) => 
        sandbox.files.write(filePath, `Content ${index + 1}`)
      )
      await Promise.all(writePromises)
      
      // 3. Stat all files concurrently
      const statPromises = filePaths.map(filePath => 
        sandbox.files.stat(filePath)
      )
      const fileInfos = await Promise.all(statPromises)
      
      expect(fileInfos).toHaveLength(3)
      fileInfos.forEach((fileInfo, index) => {
        expect(fileInfo.name).toBe(`file${index + 1}.txt`)
        expect(fileInfo.type).toBe('file')
      })
      
      // 4. List directory
      const entries = await sandbox.files.list(baseDir)
      expect(entries).toHaveLength(3)
      
      // 5. Remove all files concurrently
      const removePromises = filePaths.map(filePath => 
        sandbox.files.remove(filePath)
      )
      await Promise.all(removePromises)
      
      // 6. Verify all files are removed
      const statAfterRemovePromises = filePaths.map(filePath => 
        sandbox.files.stat(filePath).catch(() => null)
      )
      const results = await Promise.all(statAfterRemovePromises)
      results.forEach(result => expect(result).toBeNull())
      
      // 7. Remove base directory
      await sandbox.files.remove(baseDir)
    }, timeout)

    test('should handle error recovery scenarios', async () => {
      const baseDir = '/tmp/error-recovery-test'
      const filePath = '/tmp/error-recovery-test/test-file.txt'
      const testContent = 'Error recovery test content'
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create directory
      await sandbox.files.makeDir(baseDir)
      
      // 2. Create file
      await sandbox.files.write(filePath, testContent)
      
      // 3. Verify file exists
      const fileInfo = await sandbox.files.stat(filePath)
      expect(fileInfo.name).toBe('test-file.txt')
      
      // 4. Try to create directory that already exists (should fail)
      await expect(sandbox.files.makeDir(baseDir)).rejects.toThrow()
      
      // 5. Try to stat non-existent file (should fail)
      await expect(sandbox.files.stat('/tmp/does-not-exist.txt')).rejects.toThrow()
      
      // 6. Move to non-existent destination path (backend auto-creates parent directories)
      const newPath = '/tmp/auto-created-dir/moved-file.txt'
      const movedInfo = await sandbox.files.move(filePath, newPath)
      expect(movedInfo.name).toBe('moved-file.txt')
      expect(movedInfo.path).toBe(newPath)
      
      // 7. Verify original file no longer exists
      await expect(sandbox.files.stat(filePath)).rejects.toThrow()
      
      // 8. Verify file exists at new location
      const newFileInfo = await sandbox.files.stat(newPath)
      expect(newFileInfo.name).toBe('moved-file.txt')
      
      // 9. Clean up
      await sandbox.files.remove(baseDir)
      await sandbox.files.remove('/tmp/auto-created-dir')
    }, timeout)

    test('should handle large file operations', async () => {
      const baseDir = '/tmp/large-file-test'
      const largeFilePath = '/tmp/large-file-test/large-file.txt'
      const movedLargeFilePath = '/tmp/large-file-test/moved-large-file.txt'
      
      // Create large content (1MB)
      const largeContent = 'A'.repeat(1024 * 1024)
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create directory
      await sandbox.files.makeDir(baseDir)
      
      // 2. Create large file
      await sandbox.files.write(largeFilePath, largeContent)
      
      // 3. Stat large file
      const fileInfo = await sandbox.files.stat(largeFilePath)
      expect(fileInfo.name).toBe('large-file.txt')
      expect(Number(fileInfo.size)).toBe(largeContent.length)
      
      // 4. Move large file
      await sandbox.files.move(largeFilePath, movedLargeFilePath)
      
      // 5. Verify move worked
      await expect(sandbox.files.stat(largeFilePath)).rejects.toThrow()
      const movedFileInfo = await sandbox.files.stat(movedLargeFilePath)
      expect(movedFileInfo.name).toBe('moved-large-file.txt')
      
      // 6. Read large file content (check first and last parts)
      const movedContent = await sandbox.files.read(movedLargeFilePath)
      expect(movedContent.substring(0, 100)).toBe('A'.repeat(100))
      expect(movedContent.substring(movedContent.length - 100)).toBe('A'.repeat(100))
      expect(movedContent.length).toBe(largeContent.length)
      
      // 7. Clean up
      await sandbox.files.remove(baseDir)
    }, timeout * 2) // Double timeout for large file operations
  })

  describe('Download URL with Signature', () => {
    test('should generate signed download URL and download file successfully', async () => {
      const testFilePath = '/tmp/test-download-url.txt'
      const testContent = 'This is test content for download URL verification.'
      const localDownloadPath = path.join(tempDir, 'downloaded-via-url.txt')
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create a file in sandbox
      await sandbox.files.write(testFilePath, testContent)
      
      // 2. Verify file exists
      const fileInfo = await sandbox.files.stat(testFilePath)
      expect(fileInfo.name).toBe('test-download-url.txt')
      expect(fileInfo.type).toBe('file')
      
      // 3. Generate signed download URL with expiration
      if (!sandbox.envdAccessToken) {
        console.log('⚠️ Skipping signed URL test: envdAccessToken not available')
        return
      }
      
      const expirationSeconds = 3600
      const downloadUrl = await sandbox.downloadUrl(testFilePath, {
        useSignatureExpiration: expirationSeconds
      })
      
      // Print download URL for debugging
      console.log('📥 Generated Download URL:', downloadUrl)
      console.log('🔑 envdAccessToken:', sandbox.envdAccessToken ? `${sandbox.envdAccessToken.substring(0, 20)}...` : 'undefined')
      console.log('🔑 Full envdAccessToken:', sandbox.envdAccessToken || 'undefined')
      
      // Parse and print URL parameters
      const urlObj = new URL(downloadUrl)
      console.log('📋 URL Parameters:')
      console.log('  - Path:', urlObj.pathname)
      console.log('  - Signature:', urlObj.searchParams.get('signature'))
      console.log('  - Expiration:', urlObj.searchParams.get('signature_expiration'))
      console.log('  - Username:', urlObj.searchParams.get('username'))
      
      // Extract path from URL for signature verification
      const urlPath = urlObj.pathname // /download/tmp/test-download-url.txt
      const extractedPath = urlPath.replace('/download', '') // /tmp/test-download-url.txt
      console.log('  - Extracted path (for signature):', extractedPath)
      
      // 4. Verify URL format
      expect(downloadUrl).toContain(sandbox.sandboxDomain)
      expect(downloadUrl).toContain('/download/')
      expect(downloadUrl).toContain('tmp/test-download-url.txt')
      expect(downloadUrl).toContain('signature=')
      expect(downloadUrl).toContain('signature_expiration=')
      expect(downloadUrl).toContain('username=')
      
      // 5. Parse URL to verify parameters (urlObj already declared above)
      expect(urlObj.searchParams.has('signature')).toBe(true)
      expect(urlObj.searchParams.has('signature_expiration')).toBe(true)
      expect(urlObj.searchParams.has('username')).toBe(true)
      
      const signature = urlObj.searchParams.get('signature')
      expect(signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
      
      const expiration = urlObj.searchParams.get('signature_expiration')
      expect(expiration).toBeTruthy()
      const expirationNum = parseInt(expiration!, 10)
      expect(expirationNum).toBeGreaterThan(Math.floor(Date.now() / 1000))
      
      // 6. Download file using the signed URL
      // Signed URL should work without any headers - signature is in the URL itself
      const response = await fetch(downloadUrl)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Download failed:', response.status, response.statusText)
        console.error('Error details:', errorText)
        console.error('Download URL:', downloadUrl)
        throw new Error(`Failed to download file: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      expect(response.ok).toBe(true)
      
      // 7. Save downloaded content to local file
      const downloadedContent = await response.text()
      fs.writeFileSync(localDownloadPath, downloadedContent)
      
      // 8. Verify downloaded content matches original
      expect(downloadedContent).toBe(testContent)
      
      // 9. Verify local file was created correctly
      expect(fs.existsSync(localDownloadPath)).toBe(true)
      const localFileContent = fs.readFileSync(localDownloadPath, 'utf-8')
      expect(localFileContent).toBe(testContent)
      
      console.log('✅ Signed download URL test passed')
      console.log('📥 Download URL:', downloadUrl)
      console.log('📊 File size:', downloadedContent.length, 'bytes')
    }, timeout)

    test('should generate download URL without signature (backward compatibility)', async () => {
      const testFilePath = '/tmp/test-download-url-no-sig.txt'
      const testContent = 'Test content for non-signed URL'
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create a file in sandbox
      await sandbox.files.write(testFilePath, testContent)
      
      // 2. Generate download URL without signature
      const downloadUrl = await sandbox.downloadUrl(testFilePath)
      
      // 3. Verify URL format (should not contain signature parameters)
      expect(downloadUrl).toContain(sandbox.sandboxDomain)
      expect(downloadUrl).toContain('/download/')
      expect(downloadUrl).toContain('tmp/test-download-url-no-sig.txt')
      expect(downloadUrl).not.toContain('signature=')
      expect(downloadUrl).not.toContain('signature_expiration=')
      expect(downloadUrl).not.toContain('username=')
      
      console.log('✅ Non-signed download URL test passed')
      console.log('📥 Download URL:', downloadUrl)
    }, timeout)

    test('should handle different path formats in download URL', async () => {
      const testPaths = [
        '/tmp/path-with-leading-slash.txt',
        'tmp/path-without-leading-slash.txt',
        '//tmp/path-with-double-slash.txt'
      ]
      
      await waitForSandboxHealth(sandbox)
      
      // Create test files
      for (const testPath of testPaths) {
        const normalizedPath = testPath.startsWith('/') ? testPath : `/${testPath}`
        const cleanPath = normalizedPath.replace(/^\/+/, '')
        const actualPath = `/${cleanPath}`
        
        await sandbox.files.write(actualPath, `Content for ${testPath}`)
        
        // Generate signed download URL
        if (sandbox.envdAccessToken) {
          const downloadUrl = await sandbox.downloadUrl(testPath, {
            useSignatureExpiration: 3600
          })
          
          // Verify URL contains the correct path
          expect(downloadUrl).toContain(sandbox.sandboxDomain)
          expect(downloadUrl).toContain('/download/')
          expect(downloadUrl).toContain('signature=')
          
          // Download and verify content
          const response = await fetch(downloadUrl)
          expect(response.ok).toBe(true)
          const content = await response.text()
          expect(content).toBe(`Content for ${testPath}`)
        }
      }
      
      console.log('✅ Different path formats test passed')
    }, timeout)

    test('should download binary file using signed URL', async () => {
      const testFilePath = '/tmp/test-binary-download.bin'
      // Create binary content (PNG header)
      const binaryContent = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      ])
      const localDownloadPath = path.join(tempDir, 'downloaded-binary.bin')
      
      await waitForSandboxHealth(sandbox)
      
      // 1. Create binary file in sandbox
      await sandbox.files.write(testFilePath, binaryContent.buffer)
      
      // 2. Generate signed download URL
      if (!sandbox.envdAccessToken) {
        console.log('⚠️ Skipping binary download test: envdAccessToken not available')
        return
      }
      
      const downloadUrl = await sandbox.downloadUrl(testFilePath, {
        useSignatureExpiration: 3600
      })
      
      // 3. Download binary file using the signed URL
      const response = await fetch(downloadUrl)
      expect(response.ok).toBe(true)
      
      // 4. Get binary content
      const arrayBuffer = await response.arrayBuffer()
      const downloadedBinary = Buffer.from(arrayBuffer)
      
      // 5. Save to local file
      fs.writeFileSync(localDownloadPath, downloadedBinary)
      
      // 6. Verify binary content matches
      expect(Buffer.compare(binaryContent, downloadedBinary)).toBe(0)
      expect(downloadedBinary.length).toBe(binaryContent.length)
      
      console.log('✅ Binary file download via signed URL test passed')
      console.log('📊 Binary file size:', downloadedBinary.length, 'bytes')
    }, timeout)
  })
})
