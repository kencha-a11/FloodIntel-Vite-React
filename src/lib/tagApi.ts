import type { AccessTag, AccessTagInput } from '../types/accessTag'
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
