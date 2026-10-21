import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import {
  ACCEPTED_PHOTO_TYPES,
  FLOOD_LEVELS,
  MAX_PHOTO_SIZE_KB,
} from '../lib/floodLevels'
import * as reportApi from '../lib/reportApi'
import type { FieldErrors } from '../types/auth'
import type { FloodLevel, FloodReport } from '../types/report'

interface GpsFix {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt: number
}

type FormStep = 'form' | 'confirm' | 'success'

function capturePosition(): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GPS is not available on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          capturedAt: position.timestamp,
        })
      },
      (error) => reject(new Error(describeGpsError(error))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

function describeGpsError(error: GeolocationPositionError): string {
  if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
    return 'Location permission was denied. Allow location access to submit a report.'
  }

  if (error.code === GeolocationPositionError.TIMEOUT) {
    return 'GPS timed out. Move to an open area and try again.'
  }

  return 'Unable to read GPS coordinates. Try again.'
}

function formatCoordinates(gps: GpsFix): string {
  return `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`
}

function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) {
    return 'unknown accuracy'
  }

  return `±${Math.round(accuracy)} m accuracy`
}

export function FloodReportForm({
  onViewReports,
}: {
  onViewReports: () => void
}) {
  const { user, logout } = useAuth()
  const [step, setStep] = useState<FormStep>('form')
  const [level, setLevel] = useState<FloodLevel | ''>('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({})
  const [createdReport, setCreatedReport] = useState<FloodReport | null>(null)
  const photoUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function locate() {
      setIsLocating(true)
      setGpsError(null)

      try {
        const fix = await capturePosition()

        if (!cancelled) {
          setGps(fix)
        }
      } catch (err) {
        if (!cancelled) {
          setGpsError(
            err instanceof Error
              ? err.message
              : 'Unable to read GPS coordinates. Try again.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLocating(false)
        }
      }
    }

    void locate()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (photoUrlRef.current !== null) {
        URL.revokeObjectURL(photoUrlRef.current)
      }
    }
  }, [])

  function refreshLocation(): void {
    setIsLocating(true)
    setGpsError(null)

    capturePosition()
      .then((fix) => setGps(fix))
      .catch((err: unknown) => {
        setGpsError(
          err instanceof Error
            ? err.message
            : 'Unable to read GPS coordinates. Try again.',
        )
      })
      .finally(() => setIsLocating(false))
  }

  function updatePhoto(file: File | null): void {
    if (photoUrlRef.current !== null) {
      URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = null
    }

    if (file !== null) {
      photoUrlRef.current = URL.createObjectURL(file)
    }

    setPhotoPreview(photoUrlRef.current)
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null
    setPhotoError(null)

    if (file === null) {
      setPhoto(null)
      updatePhoto(null)
      return
    }

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setPhoto(null)
      updatePhoto(null)
      setPhotoError('Unsupported image format. Please use JPEG, PNG, or WebP.')
      return
    }

    if (file.size > MAX_PHOTO_SIZE_KB * 1024) {
      setPhoto(null)
      updatePhoto(null)
      setPhotoError('Photo is too large. The maximum size is 5 MB.')
      return
    }

    setPhoto(file)
    updatePhoto(file)
  }

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (level === '') {
      next.flood_level = 'Select the observed flood level.'
    }

    if (photo === null) {
      next.photo = 'A photo of the flood is required.'
    }

    if (gps === null) {
      next.gps = 'GPS coordinates are required.'
    }

    setErrors(next)

    return Object.keys(next).length === 0
  }

  function handleReview(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError(null)
    setServerFieldErrors({})

    if (validate()) {
      setStep('confirm')
    }
  }

  async function handleSubmit(): Promise<void> {
    if (isSubmitting || photo === null || gps === null || level === '') {
      return
    }

    const token = getStoredToken()

    if (token === null) {
      setError('You are not signed in.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setServerFieldErrors({})

    const observedAt = new Date(Math.min(gps.capturedAt, Date.now())).toISOString()

    try {
      const report = await reportApi.submitReport(
        token,
        {
          flood_level: level,
          latitude: gps.latitude,
          longitude: gps.longitude,
          gps_accuracy: gps.accuracy,
          notes: notes.trim() === '' ? null : notes.trim(),
          reported_at: observedAt,
        },
        photo,
      )

      setCreatedReport(report)
      setStep('success')
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.status === 401) {
          await logout()
          return
        }

        setError(err.message)
        setServerFieldErrors(err.errors)

        if (err.status === 422) {
          setStep('form')
        }
      } else {
        setError('Unable to connect to the server.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm(): void {
    setStep('form')
    setLevel('')
    setNotes('')
    setPhoto(null)
    updatePhoto(null)
    setPhotoError(null)
    setError(null)
    setErrors({})
    setServerFieldErrors({})
    setCreatedReport(null)
  }

  const levelError = errors.flood_level ?? serverFieldErrors.flood_level?.[0]
  const photoFieldError = errors.photo ?? serverFieldErrors.photo?.[0]
  const gpsFieldError = errors.gps ?? serverFieldErrors.latitude?.[0]
  const notesError = serverFieldErrors.notes?.[0]
  const selectedLevel = FLOOD_LEVELS.find((option) => option.value === level)

  if (step === 'success' && createdReport !== null) {
    return (
      <div className="report-form">
        <h2>Report submitted</h2>

        <p className="form-success">
          Report #{createdReport.id} ({createdReport.flood_level_label}) was sent
          to the command center.
        </p>

        <div className="report-form-actions">
          <button type="button" className="counter" onClick={resetForm}>
            Report another
          </button>
          <button type="button" className="counter" onClick={onViewReports}>
            View reports
          </button>
        </div>
      </div>
    )
  }

  if (step === 'confirm' && gps !== null) {
    return (
      <div className="report-form">
        <h2>Review report</h2>
        <p className="muted">
          Check the details below before sending the report to the command
          center.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <dl className="report-summary">
          <div>
            <dt>Flood level</dt>
            <dd>{selectedLevel?.label ?? level}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>
              {formatCoordinates(gps)}{' '}
              <span className="muted">({formatAccuracy(gps.accuracy)})</span>
            </dd>
          </div>
          <div>
            <dt>Observed at</dt>
            <dd>{new Date(gps.capturedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Barangay</dt>
            <dd>{user?.barangay?.name ?? 'Assigned automatically'}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{notes.trim() === '' ? 'None' : notes.trim()}</dd>
          </div>
        </dl>

        {photoPreview !== null && (
          <img className="photo-preview" src={photoPreview} alt="Flood photo preview" />
        )}

        <div className="report-form-actions">
          <button
            type="button"
            className="counter"
            disabled={isSubmitting}
            onClick={() => setStep('form')}
          >
            Back
          </button>
          <button
            type="button"
            className="counter"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="auth-form report-form" onSubmit={handleReview} noValidate>
      <h2>New flood report</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span>Flood level</span>
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value as FloodLevel | '')}
        >
          <option value="">Select a level</option>
          {FLOOD_LEVELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {levelError && <small className="field-error">{levelError}</small>}
      </label>

      <div className="gps-readout">
        <span className="field-label">Location</span>
        {isLocating ? (
          <p className="muted">Acquiring GPS coordinates…</p>
        ) : gps !== null ? (
          <p className="muted">
            {formatCoordinates(gps)} ({formatAccuracy(gps.accuracy)})
          </p>
        ) : (
          <p className="form-error" role="alert">
            {gpsError ?? 'GPS coordinates are required.'}
          </p>
        )}
        {gpsFieldError && !gpsError && (
          <small className="field-error">{gpsFieldError}</small>
        )}
        <button
          type="button"
          className="link"
          disabled={isLocating}
          onClick={refreshLocation}
        >
          {isLocating ? 'Locating…' : 'Refresh location'}
        </button>
      </div>

      <label className="field">
        <span>Photo</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handlePhotoChange}
        />
        <small className="muted">
          JPEG, PNG, or WebP up to 5 MB. The camera opens on mobile devices.
        </small>
        {photoError !== null && (
          <small className="field-error">{photoError}</small>
        )}
        {photoFieldError && photoError === null && (
          <small className="field-error">{photoFieldError}</small>
        )}
      </label>

      {photoPreview !== null && (
        <img className="photo-preview" src={photoPreview} alt="Selected flood photo" />
      )}

      <label className="field">
        <span>Notes (optional)</span>
        <textarea
          value={notes}
          maxLength={1000}
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
        />
        {notesError && <small className="field-error">{notesError}</small>}
      </label>

      <p className="muted">
        Barangay: {user?.barangay?.name ?? 'assigned automatically'} · Reported
        against your account.
      </p>

      <button type="submit">Review report</button>
    </form>
  )
}
