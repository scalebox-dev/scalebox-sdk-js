#!/usr/bin/env npx tsx

/**
 * Example: File Upload and Download with Scalebox SDK
 * 
 * This example demonstrates how to:
 * 1. Upload files to a sandbox
 * 2. Download files from a sandbox  
 * 3. Use upload/download URLs for custom operations
 * 4. Handle different file types (text, binary)
 */

import { Sandbox } from '../src/index'
import fs from 'fs'
import path from 'path'
import os from 'os'

async function main() {
  console.log('🚀 Starting file upload/download example...')

  // Create a sandbox
  const sandbox = await Sandbox.create({
    template: 'base', // Use your template name
    timeoutMs: 300_000, // 5 minutes
  })

  console.log(`✅ Created sandbox: ${sandbox.sandboxId}`)

  try {
    // Create a temporary directory for our examples
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scalebox-example-'))
    console.log(`📁 Created temp directory: ${tempDir}`)

    // Example 1: Upload a text file
    console.log('\n📤 Example 1: Upload text file')
    const textFilePath = path.join(tempDir, 'example.txt')
    const textContent = `Hello from Scalebox SDK!
This is an example text file.
Timestamp: ${new Date().toISOString()}`
    
    fs.writeFileSync(textFilePath, textContent)
    console.log(`Created local file: ${textFilePath}`)

    // Upload using the convenient uploadFile method
    const uploadResult = await sandbox.uploadFile(textFilePath, '/tmp/uploaded-example.txt')
    console.log(`✅ Uploaded file:`, uploadResult)

    // Verify the upload by reading the file in the sandbox
    const uploadedContent = await sandbox.files.read('/tmp/uploaded-example.txt')
    console.log(`📖 Content in sandbox: "${uploadedContent.substring(0, 50)}..."`)

    // Example 2: Download the file back
    console.log('\n📥 Example 2: Download file')
    const downloadPath = path.join(tempDir, 'downloaded-example.txt')
    const downloadResult = await sandbox.downloadFile('/tmp/uploaded-example.txt', downloadPath)
    console.log(`✅ Downloaded file:`, downloadResult)

    // Verify the download
    const downloadedContent = fs.readFileSync(downloadPath, 'utf-8')
    console.log(`📖 Downloaded content matches:`, downloadedContent === textContent)

    // Example 3: Upload a binary file (create a small PNG)
    console.log('\n📤 Example 3: Upload binary file')
    const binaryData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // IHDR data
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFF, // IDAT data
      0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x73, // IDAT data
      0x75, 0x01, 0x18, 0x00, 0x00, 0x00, 0x00, 0x49, // IDAT end
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82        // IEND chunk
    ])
    
    const binaryFilePath = path.join(tempDir, 'example.png')
    fs.writeFileSync(binaryFilePath, binaryData)
    console.log(`Created binary file: ${binaryFilePath} (${binaryData.length} bytes)`)

    await sandbox.uploadFile(binaryFilePath, '/tmp/example.png')
    console.log(`✅ Uploaded binary file to sandbox`)

    // Download and verify binary file
    const downloadedBinaryPath = path.join(tempDir, 'downloaded-example.png')
    await sandbox.downloadFile('/tmp/example.png', downloadedBinaryPath)
    
    const originalBinary = fs.readFileSync(binaryFilePath)
    const downloadedBinary = fs.readFileSync(downloadedBinaryPath)
    console.log(`📖 Binary file integrity:`, Buffer.compare(originalBinary, downloadedBinary) === 0)

    // Example 4: Using upload/download URLs directly
    console.log('\n🔗 Example 4: Using URLs directly')
    
    // Get upload URL
    const uploadUrl = await sandbox.uploadUrl('/tmp/url-uploaded.txt')
    console.log(`📤 Upload URL: ${uploadUrl}`)

    // You can use this URL with fetch to upload files
    const formData = new FormData()
    formData.append('file', new Blob(['Content uploaded via URL!']), '/tmp/url-uploaded.txt')
    
    // Note: In a real application, you'd need to handle authentication headers
    console.log(`💡 You can use this URL with fetch() and FormData to upload files`)

    // Get download URL
    await sandbox.files.write('/tmp/for-download.txt', 'Content for URL download')
    const downloadUrl = await sandbox.downloadUrl('/tmp/for-download.txt')
    console.log(`📥 Download URL: ${downloadUrl}`)
    console.log(`💡 You can use this URL with fetch() to download files`)

    // Example 5: Upload to nested directories
    console.log('\n📁 Example 5: Nested directories')
    const nestedUploadResult = await sandbox.uploadFile(textFilePath, '/tmp/nested/deep/directory/file.txt')
    console.log(`✅ Uploaded to nested directory:`, nestedUploadResult)

    // List the created directory structure
    const nestedList = await sandbox.files.list('/tmp/nested', { recursive: true })
    console.log(`📋 Nested directory contents:`, nestedList.map(f => ({ name: f.name, path: f.path, type: f.type })))

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })
    console.log(`🧹 Cleaned up temp directory`)

    console.log('\n🎉 File upload/download example completed successfully!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    // Always clean up the sandbox
    await sandbox.kill()
    console.log('🛑 Sandbox terminated')
  }
}

// Run the example
main().catch(console.error)
