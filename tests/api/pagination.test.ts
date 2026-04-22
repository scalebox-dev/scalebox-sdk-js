import { describe, expect, it } from 'vitest'
import { parseScaleboxListBlock } from '../../src/api/pagination'

describe('parseScaleboxListBlock', () => {
  it('reads nested pagination (canonical backend shape)', () => {
    const data = {
      templates: [{ id: 1 }],
      pagination: {
        page: 2,
        limit: 20,
        total: 45,
        total_pages: 3,
        offset: 20
      }
    }
    const { items, pagination } = parseScaleboxListBlock(data, 'templates')
    expect(items).toHaveLength(1)
    expect(pagination.page).toBe(2)
    expect(pagination.limit).toBe(20)
    expect(pagination.total).toBe(45)
    expect(pagination.totalPages).toBe(3)
    expect(pagination.offset).toBe(20)
  })

  it('falls back to legacy top-level total', () => {
    const data = {
      templates: [{ a: 1 }, { a: 2 }],
      total: 100
    }
    const { items, pagination } = parseScaleboxListBlock(data, 'templates')
    expect(items).toHaveLength(2)
    expect(pagination.total).toBe(100)
    expect(pagination.limit).toBe(2)
  })

  it('merges flat limit/offset for legacy import-jobs envelope', () => {
    const data = {
      jobs: [{ job_id: 'j1' }],
      total: 5,
      limit: 20,
      offset: 40
    }
    const { items, pagination } = parseScaleboxListBlock(data, 'jobs', {
      limit: data.limit,
      offset: data.offset
    })
    expect(items).toHaveLength(1)
    expect(pagination.total).toBe(5)
    expect(pagination.limit).toBe(20)
    expect(pagination.offset).toBe(40)
  })
})
