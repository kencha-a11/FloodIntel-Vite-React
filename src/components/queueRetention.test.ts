import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

/*
 * FR-19: a rejection is a payload problem, not a reason to destroy the
 * reporter's only copy. These guards pin the wiring the delivery helper
 * cannot prove on its own.
 */

describe('queue retention wiring', () => {
  it('has no delete path except the confirmed discard', () => {
    const provider = read('../context/QueueProvider.tsx')
    const deletions = provider.match(/removeQueueItem\(/g) ?? []

    expect(provider).toContain('deliverQueuedItem(item, replaceQueueId')
    expect(deletions).toHaveLength(1)
    expect(provider).toContain('const discard = useCallback(')
  })

  it('counts pending work through one rule', () => {
    const provider = read('../context/QueueProvider.tsx')

    expect(provider).toContain('countPendingItems(items)')
    expect(provider).not.toContain('user === null ? 0 : items.length')
  })

  it('asks before discarding and names the consequence', () => {
    const indicator = read('./QueueIndicator.tsx')

    expect(indicator).toContain('const [confirmDiscard, setConfirmDiscard]')
    expect(indicator).toContain('Discard {itemLabel(item)}?')
    expect(indicator).toContain('Its photo and saved details are deleted from this device.')
    expect(indicator).toContain('Its saved details are deleted from this device.')
    expect(indicator).toContain('This cannot be')
    expect(indicator).toContain('void discard(item.id)')
    expect(indicator).toContain('Discard {itemNoun(item)}')
    expect(indicator).toContain('Keep {itemNoun(item)}')
  })

  it('shows retained failures beside the pending count', () => {
    const indicator = read('./QueueIndicator.tsx')

    expect(indicator).toContain(
      "items.filter((item) => item.status === 'failed').length",
    )
    expect(indicator).toContain('{failedCount} failed')
  })

  it('shows the capture instant beside the save time', () => {
    const indicator = read('./QueueIndicator.tsx')

    expect(indicator).toContain('Observed at (device)')
    expect(indicator).toContain('formatInstantWithAge(observedAt)')
    expect(indicator).toContain('<time dateTime={item.observedAt}>')
  })

  it('replaces its own rejected attempt when the form is resubmitted', () => {
    const levelForm = read('./FloodReportForm.tsx')
    const impactForm = read('./FloodImpactReportForm.tsx')

    for (const form of [levelForm, impactForm]) {
      expect(form).toContain('const [failedQueueId, setFailedQueueId]')
      expect(form).toContain('replaceQueueId: failedQueueId ?? undefined')
      expect(form).toContain('setFailedQueueId(result.id)')
    }
  })
})
