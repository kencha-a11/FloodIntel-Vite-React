import { useMemo, useState } from 'react'
import {
  DEFAULT_MAP_REPORT_SORT,
  MAP_REPORT_SORT_OPTIONS,
  mapReportSortLabel,
  newestReceivedAt,
  sortMapRows,
} from '../lib/mapReportList'
import type { MapReportSort } from '../lib/mapReportList'
import {
  ALERT_TIERS,
  alertTierLabel,
  alertTierTone,
  dataSourceLabel,
  reportStatusLabel,
  reportStatusTone,
} from '../lib/vocabulary'
import type { ValidatedFeedMeta, ValidatedFeedRow } from '../types/report'
import { Badge, Button, EmptyState, Field, Select } from './ui'

/*
 * FR-59 / NFR-22: the map canvas is not readable by a keyboard or a screen
 * reader, so this list is the same validated feed as text — the same rows the
 * map already loaded, never a second fetch. Everything a marker popup shows is
 * visible on the row itself, so a row never has to be opened.
 */

function formatInstant(value: string): string {
  return new Date(value).toLocaleString()
}

function depthLabel(depth: number | null): string {
  return depth === null ? 'Not recorded' : `${depth} cm`
}

export function MapReportList({
  rows,
  meta,
}: {
  rows: ValidatedFeedRow[]
  meta: ValidatedFeedMeta | null
}) {
  const [sort, setSort] = useState<MapReportSort>(DEFAULT_MAP_REPORT_SORT)
  const [open, setOpen] = useState(true)

  const sorted = useMemo(() => sortMapRows(rows, sort), [rows, sort])

  // The live region's text follows the data, not the poll: an unchanged
  // refresh re-renders the same sentence, so nothing is re-announced, while a
  // row entering or leaving the feed changes it and is stated once.
  const summary = useMemo(() => {
    if (rows.length === 0) {
      return 'No validated reports are in view.'
    }

    const newest = newestReceivedAt(rows)

    return `${rows.length} validated report${rows.length === 1 ? '' : 's'} listed${
      newest === null ? '' : `, newest received ${formatInstant(newest)}`
    }. Sorted by ${mapReportSortLabel(sort).toLowerCase()}.`
  }, [rows, sort])

  return (
    <section
      className="map-report-list"
      aria-labelledby="map-report-list-title"
      data-testid="map-report-list"
    >
      <div className="map-report-list-header">
        <div>
          <h3 id="map-report-list-title">Validated reports — list view</h3>
          <p className="muted">
            The same validated reports the map plots, read as text. Each row
            carries the barangay, alert tier, depth, both timestamps, source, and
            status.
          </p>
        </div>
        <Button
          variant="secondary"
          size="compact"
          aria-expanded={open}
          aria-controls="map-report-list-body"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide report list' : 'Show report list'}
        </Button>
      </div>

      {open && (
        <div id="map-report-list-body" className="map-report-list-body">
          <p
            className="map-report-list-summary"
            role="status"
            data-testid="map-report-list-summary"
          >
            {summary}
          </p>

          <div className="map-report-list-toolbar">
            <Field id="map-report-sort" label="Sort report list">
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as MapReportSort)}
              >
                {MAP_REPORT_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {meta?.truncated === true && (
            <p className="muted" data-testid="map-report-list-truncation">
              The list shows the first {meta.limit} validated reports — the same
              cap as the map — so the extent is truncated.
            </p>
          )}

          {sorted.length === 0 ? (
            <EmptyState
              title="No validated reports are in view."
              description="Validated reports appear here and on the map together."
            />
          ) : (
            <ul className="map-report-items">
              {sorted.map((row) => (
                <li key={row.id} className="map-report-item">
                  <div className="map-report-item-header">
                    <Badge tone={alertTierTone(row.alert_level)}>
                      {alertTierLabel(row.alert_level)}
                    </Badge>
                    <Badge tone={reportStatusTone(row.status)}>
                      {reportStatusLabel(row.status)}
                    </Badge>
                  </div>

                  <p className="map-report-item-barangay">{row.barangay.name}</p>

                  <dl className="map-report-facts">
                    <div className="map-report-fact">
                      <dt>Alert tier</dt>
                      <dd>{ALERT_TIERS[row.alert_level].tier} of 3</dd>
                    </div>
                    <div className="map-report-fact">
                      <dt>Depth</dt>
                      <dd>{depthLabel(row.depth_cm)}</dd>
                    </div>
                    <div className="map-report-fact">
                      <dt>Observed</dt>
                      <dd>
                        <time dateTime={row.observed_at}>
                          {formatInstant(row.observed_at)}
                        </time>
                      </dd>
                    </div>
                    <div className="map-report-fact">
                      <dt>Received</dt>
                      <dd>
                        <time dateTime={row.received_at}>
                          {formatInstant(row.received_at)}
                        </time>
                      </dd>
                    </div>
                    <div className="map-report-fact">
                      <dt>Source</dt>
                      <dd>{dataSourceLabel(row.source)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
