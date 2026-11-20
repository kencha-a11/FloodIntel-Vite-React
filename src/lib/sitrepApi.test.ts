import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSitrepDocx, fetchSitrepDocumentHtml } from './sitrepApi'
import { AuthApiError } from './http'

afterEach(() => {
  vi.unstubAllGlobals()
})

const DOCUMENT_HTML =
  '<html><head><meta name="sitrep-document" content="2"></head>' +
  '<body><h1>SITUATIONAL REPORT</h1></body></html>'

// A 200 body the API might return when it is broken or out of date: the SPA
// shell with an inline module script. It must never reach the preview frame.
const SPA_SHELL_HTML =
  '<html><head><script type="module">console.log(1)</script></head>' +
  '<body><div id="root"></div></body></html>'

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function stubFetch(response: Response): void {
  vi.stubGlobal('fetch', vi.fn(async () => response))
}

describe('fetchSitrepDocumentHtml', () => {
  it('returns the frozen document when the server marker is present', async () => {
    stubFetch(
      new Response(DOCUMENT_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    )

    await expect(fetchSitrepDocumentHtml('token', 1)).resolves.toBe(DOCUMENT_HTML)
  })

  it('refuses a 200 page that is not the document so it is never framed', async () => {
    stubFetch(
      new Response(SPA_SHELL_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    )

    await expect(fetchSitrepDocumentHtml('token', 1)).rejects.toThrow(
      /unexpected page instead of the report document/,
    )
  })

  it('maps a non-OK response to an AuthApiError', async () => {
    stubFetch(
      new Response(JSON.stringify({ message: 'Unauthenticated.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(fetchSitrepDocumentHtml('token', 1)).rejects.toBeInstanceOf(AuthApiError)
  })
})

describe('fetchSitrepDocx', () => {
  it('returns the blob when the content type is the DOCX type', async () => {
    stubFetch(
      new Response(new Blob(['docx']), {
        status: 200,
        headers: { 'Content-Type': DOCX_CONTENT_TYPE },
      }),
    )

    const blob = await fetchSitrepDocx('token', 1)

    expect(blob).toBeInstanceOf(Blob)
  })

  it('refuses a 200 HTML body so an error page is never saved as a DOCX', async () => {
    stubFetch(
      new Response(SPA_SHELL_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      }),
    )

    await expect(fetchSitrepDocx('token', 1)).rejects.toThrow(
      /unexpected response instead of the DOCX export/,
    )
  })
})