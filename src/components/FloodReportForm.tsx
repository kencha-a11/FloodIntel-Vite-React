import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { useQueue } from '../context/useQueue'
import { FLOOD_LEVELS } from '../lib/floodLevels'
import { compressPhoto } from '../lib/photo'
import type { PhotoProgress } from '../lib/photo'
import { setDraftDirty } from '../lib/draftGuard'
import { getStoredToken } from '../lib/http'
import { reverseGeocode } from '../lib/geocode'
import type { FieldErrors } from '../types/auth'
import type { FloodLevel } from '../types/report'

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function describeCompression(progress: PhotoProgress): string {
  if (progress.stage === 'decoding') {
    return 'Reading photo…'
  }

  return `Optimising photo (${progress.edge}px, quality ${Math.round((progress.quality ?? 0) * 100)}%)…`
}

interface GpsFix {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt: number
}

type FormStep = 'form' | 'confirm' | 'success'

type AddressStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

function describeAddressStatus(
  status: AddressStatus,
  address: string | null,
): string {
  if (status === 'ready' && address !== null) {
    return address
  }

  if (status === 'loading') {
    return 'Looking up address…'
  }

  return 'Address unavailable'
}

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
  const { user } = useAuth()
  const { submitLevelReport } = useQueue()
  const [step, setStep] = useState<FormStep>('form')
  const [level, setLevel] = useState<FloodLevel | ''>('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoName, setPhotoName] = useState('flood-report.jpg')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionLabel, setCompressionLabel] = useState<string | null>(null)
  const [compressionStage, setCompressionStage] = useState<string | null>(null)
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(true)
  const [address, setAddress] = useState<string | null>(null)
  const [addressStatus, setAddressStatus] = useState<AddressStatus>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({})
  const [submitResult, setSubmitResult] = useState<{
    queued: boolean
    reportId: number | null
    message: string
  } | null>(null)
  const photoUrlRef = useRef<string | null>(null)
  const addressAttempt = useRef(0)

  const resolveAddress = useCallback((fix: GpsFix): void => {
    const attempt = addressAttempt.current + 1
    addressAttempt.current = attempt
    setAddress(null)
    setAddressStatus('loading')

    const token = getStoredToken()

    if (token === null || !navigator.onLine) {
      setAddressStatus('unavailable')
      return
    }

    void reverseGeocode(token, fix.latitude, fix.longitude).then((result) => {
      if (addressAttempt.current !== attempt) {
        return
      }

      if (result === null) {
        setAddressStatus('unavailable')
        return
      }

      setAddress(result)
      setAddressStatus('ready')
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function locate() {
      setIsLocating(true)
      setGpsError(null)

      try {
        const fix = await capturePosition()

        if (!cancelled) {
          setGps(fix)
          resolveAddress(fix)
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
  }, [resolveAddress])

  useEffect(() => {
    if (gps === null || addressStatus !== 'unavailable') {
      return
    }

    function handleOnline(): void {
      if (gps !== null) {
        resolveAddress(gps)
      }
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [gps, addressStatus, resolveAddress])

  useEffect(() => {
    return () => {
      if (photoUrlRef.current !== null) {
        URL.revokeObjectURL(photoUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const hasDraft =
      level !== '' || notes.trim() !== '' || photo !== null || step === 'confirm'

    setDraftDirty(hasDraft && step !== 'success')

    return () => {
      setDraftDirty(false)
    }
  }, [level, notes, photo, step])

  function refreshLocation(): void {
    setIsLocating(true)
    setGpsError(null)

    capturePosition()
      .then((fix) => {
        setGps(fix)
        resolveAddress(fix)
      })
      .catch((err: unknown) => {
        setGpsError(
          err instanceof Error
            ? err.message
            : 'Unable to read GPS coordinates. Try again.',
        )
      })
      .finally(() => setIsLocating(false))
  }

  function updatePhoto(file: Blob | null): void {
    if (photoUrlRef.current !== null) {
      URL.revokeObjectURL(photoUrlRef.current)
      photoUrlRef.current = null
    }

    if (file !== null) {
      photoUrlRef.current = URL.createObjectURL(file)
    }

    setPhotoPreview(photoUrlRef.current)
  }

  async function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0] ?? null
    setPhotoError(null)
    setCompressionLabel(null)
    setCompressionStage(null)

    if (file === null) {
      setPhoto(null)
      updatePhoto(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setPhoto(null)
      updatePhoto(null)
      setPhotoError('Only image files can be attached.')
      return
    }

    setIsCompressing(true)
    setPhoto(null)
    updatePhoto(null)

    try {
      const compressed = await compressPhoto(file, {
        onProgress: (progress) => {
          setCompressionStage(describeCompression(progress))
        },
      })

      setPhoto(compressed.blob)
      setPhotoName(
        `${file.name.replace(/\.[^.]+$/, '') || 'flood-report'}.jpg`,
      )
      updatePhoto(compressed.blob)
      setCompressionLabel(
        `${formatFileSize(compressed.originalBytes)} → ${formatFileSize(compressed.bytes)}`,
      )

      if (!compressed.meetsTarget) {
        setPhotoError(
          'The photo was reduced but is still larger than 1 MB. It will be sent below the 5 MB limit.',
        )
      }
    } catch (err) {
      setPhoto(null)
      updatePhoto(null)
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'This photo could not be processed.',
      )
    } finally {
      setIsCompressing(false)
      setCompressionStage(null)
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (level === '') {
      next.flood_level = 'Select the observed flood level.'
    }

    if (isCompressing) {
      next.photo = 'Wait for the photo to finish processing.'
    } else if (photo === null) {
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
    if (
      isSubmitting ||
      isCompressing ||
      photo === null ||
      gps === null ||
      level === ''
    ) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setServerFieldErrors({})

    const observedAt = new Date(
      Math.min(gps.capturedAt, Date.now()),
    ).toISOString()

    try {
      const result = await submitLevelReport({
        payload: {
          flood_level: level,
          latitude: gps.latitude,
          longitude: gps.longitude,
          gps_accuracy: gps.accuracy,
          notes: notes.trim() === '' ? null : notes.trim(),
          reported_at: observedAt,
        },
        observedAt,
        photo,
        photoName,
      })

      if (result.failed) {
        setError(result.message)
        return
      }

      setSubmitResult({
        queued: result.queued,
        reportId: result.reportId,
        message: result.message,
      })
      setStep('success')
      setDraftDirty(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save the report.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm(): void {
    setStep('form')
    setLevel('')
    setNotes('')
    setPhoto(null)
    setPhotoName('flood-report.jpg')
    updatePhoto(null)
    setPhotoError(null)
    setCompressionLabel(null)
    setCompressionStage(null)
    setError(null)
    setErrors({})
    setServerFieldErrors({})
    setSubmitResult(null)
    setAddress(null)
    setAddressStatus('idle')
    addressAttempt.current += 1
    setDraftDirty(false)
  }

  const levelError = errors.flood_level ?? serverFieldErrors.flood_level?.[0]
  const photoFieldError = errors.photo ?? serverFieldErrors.photo?.[0]
  const gpsFieldError = errors.gps ?? serverFieldErrors.latitude?.[0]
  const notesError = serverFieldErrors.notes?.[0]
  const selectedLevel = FLOOD_LEVELS.find((option) => option.value === level)

  if (step === 'success' && submitResult !== null) {
    return (
      <div className="report-form">
        <h2>{submitResult.queued ? 'Report saved' : 'Report submitted'}</h2>

        <p className="form-success">
          {submitResult.message}
          {submitResult.reportId !== null && !submitResult.queued
            ? ` Report #${submitResult.reportId} (${selectedLevel?.label ?? level}) is now with the command center.`
            : ''}
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
            <dt>Address</dt>
            <dd>
              {addressStatus === 'loading'
                ? 'Looking up…'
                : (address ?? 'Not available')}
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
          <>
            <p className="muted">
              {formatCoordinates(gps)} ({formatAccuracy(gps.accuracy)})
            </p>
            <p className="muted">
              {describeAddressStatus(addressStatus, address)}
              {addressStatus === 'unavailable' && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      if (gps !== null) {
                        resolveAddress(gps)
                      }
                    }}
                  >
                    Retry
                  </button>
                </>
              )}
            </p>
          </>
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
          accept="image/*"
          capture="environment"
          disabled={isCompressing}
          onChange={(event) => void handlePhotoChange(event)}
        />
        <small className="muted">
          Photos are optimised on this device before sending (1 MB target, 5 MB
          maximum). The camera opens on mobile devices.
        </small>
        {isCompressing && (
          <small className="muted">
            {compressionStage ?? 'Optimising photo…'}
          </small>
        )}
        {!isCompressing && compressionLabel !== null && (
          <small className="muted">Optimised: {compressionLabel}</small>
        )}
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
