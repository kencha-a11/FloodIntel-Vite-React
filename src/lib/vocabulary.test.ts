import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ALERT_LEVEL_ORDER,
  ALERT_TIERS,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_NOTES,
  LEGACY_DEPTH_LABELS,
  LEGACY_DEPTH_NOTE,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  alertTierLabel,
  alertTierShortLabel,
  alertTierTone,
  correctionLinkLabel,
  floodLevelLabel,
  legacyDepthLevel,
  reportStatusLabel,
  reportStatusTone,
  supersededByLabel,
} from './vocabulary'
import type { AlertLevel, FloodLevel, FloodReportStatus } from '../types/report'

describe('report status vocabulary', () => {
  it('labels all four statuses exactly as the design standard does', () => {
    expect(REPORT_STATUSES).toEqual(['submitted', 'validated', 'returned', 'rejected'])

    REPORT_STATUSES.forEach((status) => {
      expect(reportStatusLabel(status)).toBe(REPORT_STATUS_LABELS[status])
    })

    expect(REPORT_STATUS_LABELS).toEqual({
      submitted: 'Submitted',
      validated: 'Validated',
      returned: 'Returned',
      rejected: 'Rejected',
    })
  })

  it('gives every status a distinct tone', () => {
    const tones = REPORT_STATUSES.map((status) => reportStatusTone(status))

    expect(tones).toEqual(['info', 'success', 'warning', 'danger'])
    expect(new Set(tones).size).toBe(REPORT_STATUSES.length)
  })

  it('never hands a raw enum value back as a label', () => {
    REPORT_STATUSES.forEach((status) => {
      expect(reportStatusLabel(status)).not.toBe(status)
      expect(reportStatusLabel(status)[0]).toBe(reportStatusLabel(status)[0].toUpperCase())
    })
  })
})

describe('alert tier vocabulary', () => {
  it('keeps the three canonical tiers in order with their tone', () => {
    expect(ALERT_LEVEL_ORDER).toEqual(['alert', 'get_ready', 'red_alert'])
    expect(ALERT_LEVEL_ORDER.map((level: AlertLevel) => ALERT_TIERS[level].tier)).toEqual([1, 2, 3])
    expect(ALERT_LEVEL_ORDER.map((level: AlertLevel) => alertTierTone(level))).toEqual([
      'alert-1',
      'alert-2',
      'alert-3',
    ])
  })

  it('uses the canonical label and no synonym', () => {
    expect(ALERT_LEVEL_ORDER.map((level) => alertTierLabel(level))).toEqual([
      'Level 1 — Alert',
      'Level 2 — Get Ready',
      'Level 3 — Red Alert',
    ])
    expect(ALERT_LEVEL_ORDER.map((level) => alertTierShortLabel(level))).toEqual([
      'Alert',
      'Get Ready',
      'Red Alert',
    ])

    const text = ALERT_LEVEL_ORDER.map((level) => alertTierLabel(level)).join(' ').toLowerCase()

    expect(text).not.toMatch(/high|critical|severe|warning level/)
  })
})

describe('data source vocabulary', () => {
  it('names the three sources once', () => {
    expect(DATA_SOURCE_LABELS).toEqual({
      reported: 'Reported',
      derived: 'Derived',
      predicted: 'Predicted',
    })
  })

  it('states that derived is not reported and predicted has no producer', () => {
    expect(DATA_SOURCE_NOTES.derived).toMatch(/never labeled as reported/)
    expect(DATA_SOURCE_NOTES.predicted).toMatch(/Nothing produces it yet/)
  })
})

describe('legacy depth vocabulary', () => {
  it('labels every depth value', () => {
    const levels: FloodLevel[] = ['ankle', 'knee', 'waist', 'chest', 'neck']

    levels.forEach((level) => {
      expect(floodLevelLabel(level)).toBe(LEGACY_DEPTH_LABELS[level])
    })

    expect(floodLevelLabel(null)).toBeNull()
  })

  it('marks the scale as legacy and not an alert tier', () => {
    expect(LEGACY_DEPTH_NOTE).toMatch(/legacy/i)
    expect(LEGACY_DEPTH_NOTE).toMatch(/not an alert tier/)
  })

  it('accepts only the five steps', () => {
    expect([1, 2, 3, 4, 5].map((value) => legacyDepthLevel(value))).toEqual([1, 2, 3, 4, 5])
    expect(legacyDepthLevel(null)).toBeNull()
    expect(legacyDepthLevel(0)).toBeNull()
    expect(legacyDepthLevel(6)).toBeNull()
    expect(legacyDepthLevel(2.5)).toBeNull()
  })

  it('does not collide with an alert tier label', () => {
    const statuses: FloodReportStatus[] = REPORT_STATUSES
    const depthText = Object.values(LEGACY_DEPTH_LABELS).join(' ').toLowerCase()

    expect(depthText).not.toMatch(/alert/)
    statuses.forEach((status) => {
      expect(depthText).not.toContain(reportStatusLabel(status).toLowerCase())
    })
  })
})

describe('correction link vocabulary', () => {
  it('names both directions of the chain without inventing a status', () => {
    expect(correctionLinkLabel(7)).toBe('Corrects report #7')
    expect(supersededByLabel(12)).toBe('Superseded by report #12')
  })

  it('keeps the link wording out of the status labels', () => {
    const statuses = Object.values(REPORT_STATUS_LABELS)

    expect(statuses.some((label) => correctionLinkLabel(7).includes(label))).toBe(
      false,
    )
    expect(statuses.some((label) => supersededByLabel(7).includes(label))).toBe(
      false,
    )
  })
})

describe('single vocabulary', () => {
  it('keeps components off the server-supplied status, tier, and source labels', () => {
    const root = fileURLToPath(new URL('../components', import.meta.url))
    const forbidden = [
      'status_label',
      'alert_level_label',
      'source_label',
      'from_status_label',
      'to_status_label',
    ]
    const offenders: string[] = []

    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) {
        continue
      }

      const file = `${entry.parentPath}/${entry.name}`
      const source = readFileSync(file, 'utf8')

      for (const word of forbidden) {
        if (source.includes(word)) {
          offenders.push(`${entry.name}: ${word}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
