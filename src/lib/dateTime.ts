const TIMEZONE = 'Asia/Manila'
const TIMEZONE_LABEL = 'PHT'

const ABSOLUTE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TIMEZONE,
})

export const NOT_RECORDED = 'Not recorded'

function formatParts(value: string): string | null {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const parts = ABSOLUTE_FORMAT.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? ''

  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} ${part('dayPeriod').toUpperCase()} ${TIMEZONE_LABEL}`
}

/**
 * Absolute, zoneless-proof form for both review instants (design §11):
 * `02 Nov 2026, 10:00 AM PHT`. The label is fixed because this system only
 * operates on Philippine time; it never inherits the device's zone.
 */
export function formatAbsoluteInstant(value: string | null): string {
  if (value === null) {
    return NOT_RECORDED
  }

  return formatParts(value) ?? NOT_RECORDED
}

/**
 * A relative hint beside an absolute instant. A future instant (a device clock
 * ahead of the server) reads as "just now" rather than a negative age.
 */
export function describeAge(value: string, now: Date = new Date()): string {
  const milliseconds = Date.parse(value)

  if (Number.isNaN(milliseconds)) {
    return ''
  }

  const seconds = Math.max(0, Math.floor((now.getTime() - milliseconds) / 1000))

  if (seconds < 60) {
    return 'just now'
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} h ago`
  }

  return `${Math.floor(hours / 24)} d ago`
}

export function formatInstantWithAge(value: string, now: Date = new Date()): string {
  return `${formatAbsoluteInstant(value)} (${describeAge(value, now)})`
}
