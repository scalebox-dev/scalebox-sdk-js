import { describe, it, expect } from 'vitest'
import { _parseObjectStorageFromResponse } from '../../src/api/index'

describe('parseObjectStorageFromResponse', () => {
  it('returns empty object when no objectStorage', () => {
    expect(_parseObjectStorageFromResponse({})).toEqual({})
    expect(_parseObjectStorageFromResponse({ objectStorage: null })).toEqual({})
    expect(_parseObjectStorageFromResponse({ objectStorage: [] })).toEqual({})
  })

  it('handles new backend format: array with one element', () => {
    const data = {
      objectStorage: [{ uri: 's3://bucket/path/', mountPoint: '/mnt/oss' }]
    }
    expect(_parseObjectStorageFromResponse(data)).toEqual({
      objectStorage: { uri: 's3://bucket/path/', mountPoint: '/mnt/oss' },
      objectStorages: [{ uri: 's3://bucket/path/', mountPoint: '/mnt/oss' }]
    })
  })

  it('handles new backend format: array with multiple elements', () => {
    const data = {
      objectStorage: [
        { uri: 's3://bucket-a/data/', mountPoint: '/mnt/data' },
        { uri: 's3://bucket-b/models/', mountPoint: '/mnt/models' }
      ]
    }
    const result = _parseObjectStorageFromResponse(data)
    expect(result.objectStorage).toEqual({ uri: 's3://bucket-a/data/', mountPoint: '/mnt/data' })
    expect(result.objectStorages).toHaveLength(2)
    expect(result.objectStorages![1]).toEqual({ uri: 's3://bucket-b/models/', mountPoint: '/mnt/models' })
  })

  it('handles defensive case: single object (old backend shape)', () => {
    const data = {
      objectStorage: { uri: 's3://bucket/path/', mountPoint: '/mnt/oss' }
    }
    expect(_parseObjectStorageFromResponse(data)).toEqual({
      objectStorage: { uri: 's3://bucket/path/', mountPoint: '/mnt/oss' },
      objectStorages: [{ uri: 's3://bucket/path/', mountPoint: '/mnt/oss' }]
    })
  })

  it('filters out entries missing uri or mountPoint', () => {
    const data = {
      objectStorage: [
        { uri: 's3://bucket/path/', mountPoint: '/mnt/oss' },
        { uri: '', mountPoint: '/mnt/bad' },    // empty uri — filtered
        { uri: 's3://other/', mountPoint: '' }  // empty mountPoint — filtered
      ]
    }
    const result = _parseObjectStorageFromResponse(data)
    expect(result.objectStorages).toHaveLength(1)
    expect(result.objectStorage).toEqual({ uri: 's3://bucket/path/', mountPoint: '/mnt/oss' })
  })
})
