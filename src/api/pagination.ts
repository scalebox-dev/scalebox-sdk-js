/**
 * Canonical list pagination nested under API response `data.pagination`
 * (aligned with Scalebox backend ListPayload).
 */

export interface ScaleboxListPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  offset: number
}

function toFiniteInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return fallback
}

/**
 * Parse `data` object for a list endpoint: dynamic items key + optional `pagination`,
 * with backward compatibility for legacy top-level `total` (and flat limit/offset on import jobs).
 */
export function parseScaleboxListBlock(
  data: Record<string, unknown> | undefined,
  itemsKey: string,
  flatLimitOffset?: { limit?: unknown; offset?: unknown }
): { items: unknown[]; pagination: ScaleboxListPagination } {
  const raw = data && typeof data === 'object' ? data : {}
  const items = Array.isArray(raw[itemsKey]) ? (raw[itemsKey] as unknown[]) : []

  const pagRaw = raw.pagination
  const p =
    pagRaw && typeof pagRaw === 'object' && !Array.isArray(pagRaw)
      ? (pagRaw as Record<string, unknown>)
      : undefined

  const legacyTopTotal = raw.total

  const limitFromFlat = flatLimitOffset?.limit
  const offsetFromFlat = flatLimitOffset?.offset

  const limit = toFiniteInt(
    p?.limit ?? p?.page_size ?? limitFromFlat,
    items.length > 0 ? items.length : 20
  )

  const page = toFiniteInt(p?.page, 1)

  const total =
    p?.total !== undefined && p?.total !== null
      ? toFiniteInt(p?.total, items.length)
      : legacyTopTotal !== undefined && legacyTopTotal !== null
        ? toFiniteInt(legacyTopTotal, items.length)
        : items.length

  const offset =
    p?.offset !== undefined && p?.offset !== null
      ? toFiniteInt(p?.offset, Math.max(0, (page - 1) * Math.max(limit, 1)))
      : offsetFromFlat !== undefined && offsetFromFlat !== null
        ? toFiniteInt(offsetFromFlat, Math.max(0, (page - 1) * Math.max(limit, 1)))
        : Math.max(0, (page - 1) * Math.max(limit, 1))

  const totalPages =
    p?.total_pages !== undefined && p?.total_pages !== null
      ? toFiniteInt(p?.total_pages, 0)
      : limit > 0
        ? Math.ceil(total / limit)
        : 0

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      offset
    }
  }
}
