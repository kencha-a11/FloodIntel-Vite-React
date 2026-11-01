import type {
  AccessTag,
  AccessTagFilters,
  AccessTagInput,
} from '../types/accessTag'
import type { Paginated } from '../types/report'
import { API_BASE_URL, request } from './http'

/**
 * Posts a captured tag. There is deliberately no client key: a duplicate tag
 * is an accepted risk because a tag is visible and retirable (D-126), so a
 * retry after a lost response may store a second row rather than replay one.
 */
export function submitTag(
  token: string,
  tag: AccessTagInput,
): Promise<AccessTag> {
  const body: Record<string, unknown> = {
    type: tag.type,
    latitude: tag.latitude,
    longitude: tag.longitude,
    observed_at: tag.observed_at,
  }

  if (tag.note !== null) body.note = tag.note
  if (tag.landmark !== null) body.landmark = tag.landmark
  if (tag.gps_accuracy !== null) body.gps_accuracy = tag.gps_accuracy
  if (tag.address !== null) body.address = tag.address

  return request<{ data: AccessTag }>(`${API_BASE_URL}/access-tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then((response) => response.data)
}

/**
 * The one encoding of the tag list's filters (FR-120). An empty value is not
 * sent at all, so "not narrowed" is the absence of a parameter rather than a
 * sentinel the server has to recognize.
 */
export function buildTagQuery(filters: AccessTagFilters): string {
  const query = new URLSearchParams()

  if (filters.barangay_id !== '') query.set('barangay_id', filters.barangay_id)
  if (filters.type !== '') query.set('type', filters.type)
  if (filters.is_active !== '') query.set('is_active', filters.is_active)
  if (filters.from !== '') query.set('from', filters.from)
  if (filters.to !== '') query.set('to', filters.to)

  query.set('per_page', String(filters.per_page))
  query.set('page', String(filters.page))

  return query.toString()
}

/**
 * Lists the tags the caller may read (FR-119, FR-120). The scope is the
 * server's: the client only narrows what it is already allowed to see, and
 * the barangay filter is applied there only for a reader beyond its own (FR-119).
 */
export function listTags(
  token: string,
  filters: AccessTagFilters,
): Promise<Paginated<AccessTag>> {
  return request<Paginated<AccessTag>>(
    `${API_BASE_URL}/access-tags?${buildTagQuery(filters)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
}
