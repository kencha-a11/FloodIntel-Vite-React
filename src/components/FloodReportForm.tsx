import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { AccessTagStep } from './AccessTagStep'
import { CameraCapture } from './CameraCapture'
import { Alert, Button, Field, Select, Textarea, TextInput } from './ui'
import { useQueue } from '../context/useQueue'
import { ALERT_LEVELS, FLOOD_TYPES, floodTypeLabel } from '../lib/alertLevels'
import {
  EMPTY_TAG_DRAFT,
  resolveTagDraft,
} from '../lib/accessTagDraft'
import type {
  TagDraft,
  TagDraftErrors,
  TagDraftResolution,
} from '../lib/accessTagDraft'
import { useAccessTagTypes } from '../lib/useAccessTagTypes'
import { compressPhoto } from '../lib/photo'
import type { PhotoProgress } from '../lib/photo'
import { setDraftDirty } from '../lib/draftGuard'
import { getStoredToken } from '../lib/http'
import { reverseGeocode } from '../lib/geocode'
import type { FieldErrors } from '../types/auth'
import type { AlertLevel, FloodType } from '../types/report'
import type { SubmitReportResult } from '../types/queue'

// The pin map is MapLibre: loaded only once a fix exists, so a reporter never
// downloads the map stack before the location is known (D-115).
const LocationPinMap = lazy(() => import('./LocationPinMap'))

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

/**
 * What the success screen says about the optional tag. `pending` is the moment
 * between the report's answer and the tag's own, and exists so a slow tag can
 * never delay the report's confirmation (FR-116, D-130).
 */
interface TagOutcome {
  status: 'pending' | 'recorded' | 'queued' | 'failed' | 'skipped'
  message: string
}

type ReadyTag = Extract<TagDraftResolution, { status: 'ready' }>

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

function tagAlertTone(status: TagOutcome['status']): 'info' | 'success' | 'warning' {
  if (status === 'recorded') {
    return 'success'
  }

  return status === 'failed' ? 'warning' : 'info'
}

function incompleteTagMessage(errors: TagDraftErrors): string {
  const reason = errors.type ?? errors.note ?? 'The details are incomplete.'

  return `The access tag was not recorded. ${reason} The report is unaffected.`
}

function tagOutcomeFrom(result: SubmitReportResult): TagOutcome {
  if (result.failed) {
    return {
      status: 'failed',
      message: `The access tag was not recorded. ${result.message} The report is unaffected.`,
    }
  }

  if (result.queued) {
    return {
      status: 'queued',
      message:
        'Access tag saved on this device. It will send when the connection returns.',
    }
  }

  return { status: 'recorded', message: result.message }
}

export function FloodReportForm({
  correctsReportId = null,
  canRecordTag = false,
  onCorrectionCleared,
  onViewReports,
}: {
  correctsReportId?: number | null
  canRecordTag?: boolean
  onCorrectionCleared?: () => void
  onViewReports: () => void
}) {
  const { user } = useAuth()
  const { submitLevelReport, submitTag } = useQueue()
  const tagTypes = useAccessTagTypes(canRecordTag)
  const [step, setStep] = useState<FormStep>('form')
  const [alertLevel, setAlertLevel] = useState<AlertLevel | ''>('')
  const [floodType, setFloodType] = useState<FloodType | ''>('')
  const [depthCm, setDepthCm] = useState<number | null>(null)
  const [landmark, setLandmark] = useState('')
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
    tag: TagOutcome | null
  } | null>(null)
  const [failedQueueId, setFailedQueueId] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState<TagDraft>(EMPTY_TAG_DRAFT)
  const [tagErrors, setTagErrors] = useState<TagDraftErrors>({})
  const photoUrlRef = useRef<string | null>(null)
  const addressAttempt = useRef(0)
  const tagAttempt = useRef(0)

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
      alertLevel !== '' ||
      notes.trim() !== '' ||
      photo !== null ||
      tagDraft.enabled ||
      step === 'confirm'

    setDraftDirty(hasDraft && step !== 'success')

    return () => {
      setDraftDirty(false)
    }
  }, [alertLevel, notes, photo, tagDraft, step])

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

  async function handleCapturedPhoto(file: Blob): Promise<void> {
    setPhotoError(null)
    setCompressionLabel(null)
    setCompressionStage(null)



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
        `${'flood-report'}.jpg`,
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

    if (alertLevel === '') {
      next.alert_level = 'Select the alert level.'
    }

    if (floodType === '') {
      next.flood_type = 'Select the flood type.'
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

    // The step never stops the report (FR-116); its messages are set here so
    // a reporter who enabled the tag can see what is missing on the way past.
    const tag = resolveTagDraft(tagDraft, tagTypes.options)
    setTagErrors(tag.status === 'incomplete' ? tag.errors : {})

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
      alertLevel === '' ||
      floodType === ''
    ) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setServerFieldErrors({})

    const observedAt = new Date(
      Math.min(gps.capturedAt, Date.now()),
    ).toISOString()
    const tag = canRecordTag
      ? resolveTagDraft(tagDraft, tagTypes.options)
      : ({ status: 'skipped' } as const)
    const attempt = tagAttempt.current

    try {
      const result = await submitLevelReport({
        payload: {
          flood_level: null,
          alert_level: alertLevel,
          flood_type: floodType,
          depth_cm: depthCm,
          landmark: landmark.trim() === '' ? null : landmark.trim(),
          latitude: gps.latitude,
          longitude: gps.longitude,
          gps_accuracy: gps.accuracy,
          notes: notes.trim() === '' ? null : notes.trim(),
          reported_at: observedAt,
          supersedes_id: correctsReportId,
        },
        observedAt,
        photo,
        photoName,
        replaceQueueId: failedQueueId ?? undefined,
      })

      if (result.failed) {
        setFailedQueueId(result.id)
        setError(result.message)
        return
      }

      setFailedQueueId(null)
      setSubmitResult({
        queued: result.queued,
        reportId: result.reportId,
        message: result.message,
        // The report's answer is shown first; the tag is attempted after it,
        // so a slow or failing tag never delays or changes that answer
        // (FR-116, D-130).
        tag:
          tag.status === 'ready'
            ? { status: 'pending', message: 'Recording the access tag…' }
            : tag.status === 'incomplete'
              ? {
                  status: 'skipped',
                  message: incompleteTagMessage(tag.errors),
                }
              : null,
      })
      setStep('success')
      setDraftDirty(false)
      onCorrectionCleared?.()

      if (tag.status === 'ready') {
        void recordTag(tag, gps, observedAt, attempt)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save the report.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function recordTag(
    tag: ReadyTag,
    fix: GpsFix,
    observedAt: string,
    attempt: number,
  ): Promise<void> {
    // The tag reuses the report's fix and capture instant rather than asking
    // for a second one (FR-116, FR-117).
    try {
      const result = await submitTag({
        type: tag.input.type,
        note: tag.input.note,
        landmark: tag.input.landmark,
        latitude: fix.latitude,
        longitude: fix.longitude,
        gps_accuracy: fix.accuracy,
        address: addressStatus === 'ready' ? address : null,
        observed_at: observedAt,
      })

      applyTagOutcome(attempt, tagOutcomeFrom(result))
    } catch (err) {
      applyTagOutcome(attempt, {
        status: 'failed',
        message: `The access tag was not recorded. ${
          err instanceof Error ? err.message : 'Try again from the queue.'
        } The report is unaffected.`,
      })
    }
  }

  function applyTagOutcome(attempt: number, outcome: TagOutcome): void {
    // A reset form is a new capture; a late tag line must not land on it.
    if (tagAttempt.current !== attempt) {
      return
    }

    setSubmitResult((current) =>
      current === null ? current : { ...current, tag: outcome },
    )
  }

  function resetForm(): void {
    setStep('form')
    setAlertLevel('')
    setFloodType('')
    setDepthCm(null)
    setLandmark('')
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
    setFailedQueueId(null)
    setTagDraft(EMPTY_TAG_DRAFT)
    setTagErrors({})
    tagAttempt.current += 1
    setGps(null)
    setAddress(null)
    setAddressStatus('idle')
    addressAttempt.current += 1
    setDraftDirty(false)
    refreshLocation()
  }

  const photoFieldError = errors.photo ?? serverFieldErrors.photo?.[0]
  const gpsFieldError = errors.gps ?? serverFieldErrors.latitude?.[0]
  const notesError = serverFieldErrors.notes?.[0]
  const photoMessage = photoError ?? photoFieldError ?? null
  const locationMessage = gpsError ?? gpsFieldError ?? null
  const selectedAlertLevel = ALERT_LEVELS.find((option) => option.value === alertLevel)
  const selectedTagLabel = tagTypes.options.find(
    (option) => option.value === tagDraft.type,
  )?.label

  if (step === 'success' && submitResult !== null) {
    return (
      <div className="report-form">
        <h2>{submitResult.queued ? 'Report saved' : 'Report submitted'}</h2>

        <Alert tone="success">
          {submitResult.message}
          {submitResult.reportId !== null && !submitResult.queued
            ? ` Report #${submitResult.reportId} (${selectedAlertLevel?.label ?? alertLevel}) is now with the command center.`
            : ''}
        </Alert>

        {submitResult.tag !== null && (
          <Alert tone={tagAlertTone(submitResult.tag.status)}>
            {submitResult.tag.message}
          </Alert>
        )}

        <div className="report-form-actions">
          <Button variant="secondary" onClick={resetForm}>
            Report another
          </Button>
          <Button variant="secondary" onClick={onViewReports}>
            View reports
          </Button>
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

        {error && <Alert tone="danger">{error}</Alert>}

        <dl className="report-summary">
          <div>
            <dt>Alert level</dt>
            <dd>{selectedAlertLevel?.label ?? alertLevel}</dd>
          </div>
          <div>
            <dt>Flood type</dt>
            <dd>{floodType === '' ? '' : floodTypeLabel(floodType)}</dd>
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
          {correctsReportId !== null && (
            <div>
              <dt>Correction of</dt>
              <dd>Report #{correctsReportId}</dd>
            </div>
          )}
          <div>
            <dt>Barangay</dt>
            <dd>{user?.barangay?.name ?? 'Assigned automatically'}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{notes.trim() === '' ? 'None' : notes.trim()}</dd>
          </div>
          {canRecordTag && tagDraft.enabled && (
            <div>
              <dt>Access tag</dt>
              <dd>{selectedTagLabel ?? 'Not chosen'}</dd>
            </div>
          )}
        </dl>

        {photoPreview !== null && (
          <img className="photo-preview" src={photoPreview} alt="Flood photo preview" />
        )}

        <div className="report-form-actions">
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => setStep('form')}
          >
            Back
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className="ui-form report-form" onSubmit={handleReview} noValidate>
      <h2>
        {correctsReportId === null ? 'New flood report' : 'Correct a flood report'}
      </h2>

      {correctsReportId !== null && (
        <Alert tone="info">
          Answering report #{correctsReportId}. A correction is a new report;
          the returned report stays in the record unchanged.
          {onCorrectionCleared !== undefined && (
            <>
              {' '}
              <Button
                variant="quiet"
                size="compact"
                onClick={onCorrectionCleared}
              >
                Stop correcting
              </Button>
            </>
          )}
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <Field
        id="report-alert-level"
        label="Alert level"
        error={errors.alert_level}
      >
        <Select
          value={alertLevel}
          onChange={(event) => setAlertLevel(event.target.value as AlertLevel | '')}
        >
          <option value="">Select a level</option>
          {ALERT_LEVELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="report-flood-type" label="Flood type" error={errors.flood_type}>
        <Select
          value={floodType}
          onChange={(event) => setFloodType(event.target.value as FloodType | '')}
        >
          <option value="">Select a type</option>
          {FLOOD_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="report-depth" label="Depth (cm, optional)">
        <TextInput
          type="number"
          min={0}
          value={depthCm === null ? '' : depthCm}
          onChange={(event) => {
            const v = event.target.value
            setDepthCm(v === '' ? null : Number(v))
          }}
        />
      </Field>

      <Field id="report-landmark" label="Landmark (optional)">
        <TextInput
          type="text"
          value={landmark}
          onChange={(event) => setLandmark(event.target.value)}
        />
      </Field>

      <div
        className="gps-readout"
        role="group"
        aria-labelledby="report-location-label"
        aria-describedby={locationMessage === null ? undefined : 'report-location-error'}
        aria-invalid={locationMessage === null ? undefined : true}
      >
        <span className="field-label" id="report-location-label">Location</span>
        {isLocating ? (
          <p className="muted">Acquiring GPS coordinates…</p>
        ) : (
          gps !== null && (
            <>
              <p className="muted">
                {formatCoordinates(gps)} ({formatAccuracy(gps.accuracy)})
              </p>
              <p className="muted">
                {describeAddressStatus(addressStatus, address)}
                {addressStatus === 'unavailable' && (
                  <>
                    {' '}
                    <Button
                      variant="quiet"
                      onClick={() => {
                        if (gps !== null) {
                          resolveAddress(gps)
                        }
                      }}
                    >
                      Retry
                    </Button>
                  </>
                )}
              </p>
            </>
          )
        )}
        {gps !== null && !isLocating && (
          <Suspense fallback={<p className="muted">Loading map…</p>}>
            <LocationPinMap
              latitude={gps.latitude}
              longitude={gps.longitude}
              accuracy={gps.accuracy}
              label="Map pin for this report"
            />
          </Suspense>
        )}
        {locationMessage !== null &&
          (gpsError !== null ? (
            <Alert tone="danger" id="report-location-error">
              {gpsError}
            </Alert>
          ) : (
            <small id="report-location-error" className="field-error">
              {locationMessage}
            </small>
          ))}
        <Button
          variant="quiet"
          disabled={isLocating}
          onClick={refreshLocation}
        >
          {isLocating ? 'Locating…' : 'Refresh location'}
        </Button>
      </div>

      <div
        className="photo-field"
        role="group"
        aria-labelledby="report-photo-label"
        aria-describedby={
          photoMessage === null
            ? 'report-photo-guidance'
            : 'report-photo-guidance report-photo-error'
        }
        aria-invalid={photoMessage === null ? undefined : true}
      >
        <span className="field-label" id="report-photo-label">Photo</span>
        <small id="report-photo-guidance" className="muted">
          Show the waterline against a meter stick or the gauge post, and include the
          road. A dry post on its own does not show a flood.
        </small>
        <CameraCapture
          onCapture={(blob) => void handleCapturedPhoto(blob)}
          onError={(message) => setPhotoError(message)}
        />
        {isCompressing && compressionStage !== null && (
          <small className="muted">{compressionStage}</small>
        )}
        {!isCompressing && compressionLabel !== null && (
          <small className="muted">Photo optimised: {compressionLabel}</small>
        )}
        {photoMessage !== null && (
          <small id="report-photo-error" className="field-error">
            {photoMessage}
          </small>
        )}
      </div>

      {photoPreview !== null && (
        <img className="photo-preview" src={photoPreview} alt="Selected flood photo" />
      )}

      <Field id="report-notes" label="Notes (optional)" error={notesError}>
        <Textarea
          value={notes}
          maxLength={1000}
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      {canRecordTag && gps !== null && (
        <AccessTagStep
          draft={tagDraft}
          onChange={setTagDraft}
          options={tagTypes.options}
          status={tagTypes.status}
          onReload={tagTypes.reload}
          errors={tagErrors}
          location={formatCoordinates(gps)}
        />
      )}

      <p className="muted">
        Barangay: {user?.barangay?.name ?? 'assigned automatically'} · Reported
        against your account.
      </p>

      <Button type="submit">Review report</Button>
    </form>
  )
}
