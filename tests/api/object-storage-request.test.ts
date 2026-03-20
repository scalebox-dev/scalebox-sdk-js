import { describe, it, expect } from 'vitest'
import { _mergeObjectStorageForRequest } from '../../src/api/index'

const mount = (suffix: string) => ({
  uri: `s3://bucket/${suffix}/`,
  mountPoint: `/mnt/${suffix}`,
  accessKey: 'ak',
  secretKey: 'sk',
  region: 'ap-southeast-1',
})

describe('mergeObjectStorageForRequest', () => {
  it('returns undefined when neither single nor array provided', () => {
    expect(_mergeObjectStorageForRequest(undefined, undefined)).toBeUndefined()
  })

  it('returns undefined when array is empty and single is undefined', () => {
    expect(_mergeObjectStorageForRequest(undefined, [])).toBeUndefined()
  })

  it('wraps single objectStorage into array of 1', () => {
    const single = mount('data')
    const result = _mergeObjectStorageForRequest(single, undefined)
    expect(result).toHaveLength(1)
    expect(result![0].uri).toBe('s3://bucket/data/')
  })

  it('passes objectStorages array through as-is', () => {
    const multi = [mount('data'), mount('models')]
    const result = _mergeObjectStorageForRequest(undefined, multi)
    expect(result).toHaveLength(2)
    expect(result![0].mountPoint).toBe('/mnt/data')
    expect(result![1].mountPoint).toBe('/mnt/models')
  })

  it('merges single + array with single first', () => {
    const single = mount('legacy')
    const multi = [mount('data'), mount('models')]
    const result = _mergeObjectStorageForRequest(single, multi)
    expect(result).toHaveLength(3)
    expect(result![0].mountPoint).toBe('/mnt/legacy')
    expect(result![1].mountPoint).toBe('/mnt/data')
    expect(result![2].mountPoint).toBe('/mnt/models')
  })
})
