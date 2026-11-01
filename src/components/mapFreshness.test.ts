import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * GIS-05: the heatmap is a feed surface like the queue, so its change signal is
 * the shared one. A map-local timer or a duplicated freshness strip would fork
 * fallback rule 3 and let the two screens disagree about what "live" means.
 */

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('map freshness signal', () => {
  it('drives the feed through the shared poll, realtime seam, and FreshnessBar', () => {
    const source = read('./MapView.tsx')

    for (const seam of [
      "from '../lib/useFeedPoll'",
      "from '../lib/useRealtimeFeed'",
      "from '../lib/feedPoll'",
      "import { FreshnessBar } from './FreshnessBar'",
    ]) {
      expect(source, `MapView.tsx is missing ${seam}`).toContain(seam)
    }
  })

  it('pauses the shared poll when the tab is hidden', () => {
    const hook = read('../lib/useFeedPoll.ts')

    expect(hook).toContain("from './pageVisibility'")
    expect(hook).toContain('pauseWhenHidden')
    expect(hook).toContain('if (paused)')

    // The pause is the hook's job, so a screen re-implementing it would double
    // up and could keep a map-local fetch running in the background.
    for (const source of [read('./MapView.tsx'), read('./ReportList.tsx')]) {
      expect(source).not.toContain('usePageVisible')
    }
  })

  it('keeps the poll precedence rule in one shared predicate', () => {
    expect(read('./MapView.tsx')).toContain('feedPollEnabled(')
    expect(read('./ReportList.tsx')).toContain('feedPollEnabled(')
  })

  it('owns no map-local timer or duplicated freshness markup', () => {
    const source = read('./MapView.tsx')

    expect(source).not.toContain('setInterval')
    expect(source).not.toContain('setTimeout')
    expect(source).not.toContain('describeFreshness')
    expect(source).not.toContain('freshness-badge')
  })

  it('refreshes on a status transition rather than every event', () => {
    expect(read('./MapView.tsx')).toContain('affectsValidatedFeed(update)')
  })

  it('states a failed refresh and keeps the last plotted set', () => {
    const source = read('./MapView.tsx')

    expect(source).toContain('appliedRef')
    expect(source).toContain('map-refresh-failure')
  })
})
