import type {
  SituationalReport,
  SitrepRunStatusRow,
  SitrepSupplement,
  SitrepSupplementInput,
} from '../types/sitrep'
import { API_BASE_URL, AuthApiError, NetworkTimeoutError, request } from './http'

/*
 * The command-center SITREP API (D-42, D-43, D-147). JSON reads and writes go
 * through the shared request path; the document preview and the DOCX export
 * are non-JSON, so they use a raw authed fetch with the same timeout and
 * error mapping. The bearer token is the only credential on every path —
 * there is no public or tokenized document link (FR-86).
 */

const RENDER_TIMEOUT_MS = 120_000

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export function listSitrepReports(
  token: string,
  options: { perPage?: number } = {},
): Promise<SituationalReport[]> {
  const query = new URLSearchParams({ per_page: String(options.perPage ?? 20) })

  return request<{ data: SituationalReport[] }>(
    `${API_BASE_URL}/situational-reports?${query.toString()}`,
    { headers: authHeaders(token) },
  ).then((response) => response.data)
}

export function prepareSitrep(
  token: string,
  eventId: number | null,
): Promise<SituationalReport> {
  return request<{ data: SituationalReport }>(`${API_BASE_URL}/situational-reports`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId }),
  }).then((response) => response.data)
}

export function getSitrepReport(token: string, id: number): Promise<SituationalReport> {
  return request<{ data: SituationalReport }>(
    `${API_BASE_URL}/situational-reports/${id}`,
    { headers: authHeaders(token) },
  ).then((response) => response.data)
}

export function issueSitrep(
  token: string,
  id: number,
  office: Record<string, string> = {},
): Promise<SituationalReport> {
  return request<{ data: SituationalReport }>(
    `${API_BASE_URL}/situational-reports/${id}/issue`,
    {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ office }),
    },
  ).then((response) => response.data)
}

export function listSitrepRuns(token: string): Promise<SitrepRunStatusRow[]> {
  return request<{ data: SitrepRunStatusRow[] }>(
    `${API_BASE_URL}/situational-reports/runs/status`,
    { headers: authHeaders(token) },
  ).then((response) => response.data)
}

export function listSitrepSupplements(
  token: string,
  eventId: number,
): Promise<SitrepSupplement[]> {
  const query = new URLSearchParams({ event_id: String(eventId) })

  return request<{ data: SitrepSupplement[] }>(
    `${API_BASE_URL}/sitrep-supplements?${query.toString()}`,
    { headers: authHeaders(token) },
  ).then((response) => response.data)
}

export function createSitrepSupplement(
  token: string,
  input: SitrepSupplementInput,
): Promise<SitrepSupplement> {
  return request<{ data: SitrepSupplement }>(`${API_BASE_URL}/sitrep-supplements`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((response) => response.data)
}

export function updateSitrepSupplement(
  token: string,
  id: number,
  input: Omit<SitrepSupplementInput, 'event_id'>,
): Promise<SitrepSupplement> {
  return request<{ data: SitrepSupplement }>(
    `${API_BASE_URL}/sitrep-supplements/${id}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  ).then((response) => response.data)
}

export function deleteSitrepSupplement(token: string, id: number): Promise<void> {
  return request<void>(`${API_BASE_URL}/sitrep-supplements/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

/**
 * The frozen document as printable HTML. Fetched with the bearer token and
 * handed to a sandboxed frame as srcDoc; the HTML is never a navigable URL.
 */
export function fetchSitrepDocumentHtml(token: string, id: number): Promise<string> {
  return rawAuthed(token, `${API_BASE_URL}/situational-reports/${id}/document`).then(
    (response) => response.text(),
  )
}

export function fetchSitrepDocx(token: string, id: number): Promise<Blob> {
  return rawAuthed(token, `${API_BASE_URL}/situational-reports/${id}/docx`).then(
    (response) => response.blob(),
  )
}

async function rawAuthed(token: string, url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: authHeaders(token),
      credentials: 'include',
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string
      } | null

      throw new AuthApiError(
        body?.message ?? 'Unable to render the situational report.',
        response.status,
      )
    }

    return response
  } catch (err) {
    if (controller.signal.aborted) {
      throw new NetworkTimeoutError('The render timed out.')
    }

    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function sitrepDocxFilename(report: Pick<SituationalReport, 'id'>): string {
  return `SITREP-revision-${report.id}.docx`
}