import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { NOT_RECORDED, formatInstantWithAge } from '../lib/dateTime'
import { AuthApiError, getStoredToken } from '../lib/http'
import type { Permissions } from '../lib/permissions'
import { listBarangays } from '../lib/reportApi'
import { listTags } from '../lib/tagApi'
import { useAccessTagTypes } from '../lib/useAccessTagTypes'
import type { AccessTag, AccessTagFilters } from '../types/accessTag'
import type { Barangay } from '../types/report'
import { Alert, Badge, Button, EmptyState, Field, Select, Spinner, TextInput } from './ui'

/*
 * The command center's read of recorded constraints (FR-119, FR-120, A11Y-07).
 * It narrows what the server already scoped and never edits a tag: retirement
 * is recorded against the tag itself (FR-121), and a list is not the surface
 * that changes a record (D-132).
 */

const EMPTY_FILTERS: AccessTagFilters = {
  barangay_id: '',
  type: '',
  // Active first: the operational question is which places block a route now.
  is_active: '1',
  from: '',
  to: '',
  per_page: 15,
  page: 1,
}

function startOfDay(value: string): string {
  return value === '' ? '' : `${value}T00:00:00`
}

function endOfDay(value: string): string {
  return value === '' ? '' : `${value}T23:59:59`
}

/** One recorded constraint, live or retired, with the provenance of both. */
export function AccessTagRows({ tags }: { tags: AccessTag[] }) {
  return (
    <ul className="tag-items">
      {tags.map((tag) => (
        <li
          key={tag.id}
          className={tag.is_active ? 'tag-row' : 'tag-row tag-row-retired'}
        >
          <div className="tag-row-header">
            <Badge tone="info">{tag.type_label}</Badge>
            <Badge tone={tag.is_active ? 'success' : 'neutral'}>
              {tag.is_active ? 'Active' : 'Retired'}
            </Badge>
          </div>
          <p className="tag-row-meta">
            {tag.barangay.name} · Recorded by {tag.recorded_by.first_name}{' '}
            {tag.recorded_by.last_name}
          </p>
          <p className="tag-row-meta">
            Landmark: {tag.landmark ?? NOT_RECORDED}
          </p>
          {tag.address !== null && (
            <p className="tag-row-meta">Address: {tag.address}</p>
          )}
          <p className="tag-row-meta">
            Observed{' '}
            <time dateTime={tag.observed_at}>
              {formatInstantWithAge(tag.observed_at)}
            </time>
          </p>
          {tag.note !== null && <p className="tag-row-notes">{tag.note}</p>}
          {tag.retired_at !== null && (
            <p className="tag-row-meta">
              Retired{' '}
              <time dateTime={tag.retired_at}>
                {formatInstantWithAge(tag.retired_at)}
              </time>
              {tag.retired_by !== null &&
                ` by ${tag.retired_by.first_name} ${tag.retired_by.last_name}`}
              {tag.retired_reason !== null && ` — ${tag.retired_reason}`}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

export function AccessTagList({ permissions }: { permissions: Permissions }) {
  const { logout } = useAuth()
  const [filters, setFilters] = useState<AccessTagFilters>(EMPTY_FILTERS)
  const [tags, setTags] = useState<AccessTag[] | null>(null)
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const types = useAccessTagTypes(true)

  useEffect(() => {
    let cancelled = false

    async function loadTags() {
      const token = getStoredToken()

      if (token === null) {
        return
      }

      try {
        const response = await listTags(token, {
          ...filters,
          from: startOfDay(filters.from),
          to: endOfDay(filters.to),
        })

        if (cancelled) {
          return
        }

        setTags(response.data)
        setCurrentPage(response.meta.current_page)
        setLastPage(response.meta.last_page)
        setTotal(response.meta.total)
        setError(null)
      } catch (err) {
        if (cancelled) {
          return
        }

        if (err instanceof AuthApiError && err.status === 401) {
          await logout()
          return
        }

        setTags(null)
        setError(
          err instanceof AuthApiError
            ? err.message
            : 'Unable to connect to the server.',
        )
      }
    }

    void loadTags()

    return () => {
      cancelled = true
    }
  }, [filters, logout, reloadKey])

  useEffect(() => {
    if (!permissions.viewAllBarangays) {
      return
    }

    let cancelled = false

    async function loadBarangays() {
      const token = getStoredToken()

      if (token === null) {
        return
      }

      try {
        const response = await listBarangays(token)

        if (!cancelled) {
          setBarangays(response)
        }
      } catch {
        setBarangays([])
      }
    }

    void loadBarangays()

    return () => {
      cancelled = true
    }
  }, [permissions.viewAllBarangays])

  function updateFilter(
    key: keyof AccessTagFilters,
    value: string,
  ): void {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function goToPage(page: number): void {
    setFilters((current) => ({ ...current, page }))
  }

  function retry(): void {
    setError(null)
    setTags(null)
    setReloadKey((key) => key + 1)
  }

  const isLoading = tags === null && error === null

  return (
    <div className="tag-list">
      <h2>Access tags</h2>
      <p className="muted">
        Places response teams cannot pass, or can pass only on foot or by
        carrying equipment. Read-only: a tag is retired on its own record, not
        from this list.
      </p>

      {error !== null && <Alert tone="danger">{error}</Alert>}

      <div className="filter-bar">
        <Field id="tag-filter-type" label="Constraint type">
          <Select
            value={filters.type}
            onChange={(event) => updateFilter('type', event.target.value)}
          >
            <option value="">All constraint types</option>
            {types.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="tag-filter-state" label="State">
          <Select
            value={filters.is_active}
            onChange={(event) => updateFilter('is_active', event.target.value)}
          >
            <option value="1">Active only</option>
            <option value="0">Retired only</option>
            <option value="">Active and retired</option>
          </Select>
        </Field>

        <Field id="tag-filter-barangay" label="Barangay">
          <Select
            value={filters.barangay_id}
            onChange={(event) => updateFilter('barangay_id', event.target.value)}
          >
            <option value="">All barangays</option>
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="tag-filter-from" label="From">
          <TextInput
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </Field>

        <Field id="tag-filter-to" label="To">
          <TextInput
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </Field>
      </div>

      {isLoading ? (
        <Spinner label="Loading access tags…" />
      ) : error !== null ? (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      ) : tags === null ? null : tags.length === 0 ? (
        <EmptyState title="No access tags found." />
      ) : (
        <AccessTagRows tags={tags} />
      )}

      {total > 0 && (
        <div className="pagination">
          <Button
            variant="secondary"
            size="compact"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="muted">
            Page {currentPage} of {lastPage} · {total} access tags
          </span>
          <Button
            variant="secondary"
            size="compact"
            disabled={currentPage >= lastPage || isLoading}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
