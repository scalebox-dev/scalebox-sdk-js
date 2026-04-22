import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiClient, SandboxPaginator } from '../../src'

const emptyPage = (page: number, totalPages: number, limit = 20) => ({
  sandboxes: [],
  pagination: { page, limit, total: limit * totalPages, totalPages, offset: (page - 1) * limit }
})

describe('SandboxPaginator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards offset/skip on first fetch and clears them afterwards', async () => {
    const spy = vi.spyOn(ApiClient.prototype, 'listSandboxes')
      .mockResolvedValueOnce(emptyPage(3, 5))
      .mockResolvedValueOnce(emptyPage(4, 5))

    const paginator = new SandboxPaginator({
      apiKey: 'test-key',
      apiUrl: 'https://api.example.com',
      limit: 20,
      offset: 40,
      skip: 10
    })

    await paginator.nextItems()
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 40, skip: 10 }))

    await paginator.nextItems()
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      offset: undefined,
      skip: undefined,
      page: 4
    }))
  })

  it('stops when current page reaches totalPages', async () => {
    vi.spyOn(ApiClient.prototype, 'listSandboxes').mockResolvedValueOnce(emptyPage(2, 2))

    const paginator = new SandboxPaginator({ apiKey: 'k', apiUrl: 'https://api.example.com' })
    expect(paginator.hasNext).toBe(true)
    await paginator.nextItems()
    expect(paginator.hasNext).toBe(false)
  })

  it('stops on empty results (totalPages = 0)', async () => {
    vi.spyOn(ApiClient.prototype, 'listSandboxes').mockResolvedValueOnce({
      sandboxes: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, offset: 0 }
    })

    const paginator = new SandboxPaginator({ apiKey: 'k', apiUrl: 'https://api.example.com' })
    await paginator.nextItems()
    expect(paginator.hasNext).toBe(false)
  })

  it('throws when nextItems is called after exhaustion', async () => {
    vi.spyOn(ApiClient.prototype, 'listSandboxes').mockResolvedValueOnce(emptyPage(1, 1))

    const paginator = new SandboxPaginator({ apiKey: 'k', apiUrl: 'https://api.example.com' })
    await paginator.nextItems()
    await expect(paginator.nextItems()).rejects.toThrow('No more items to fetch')
  })
})
