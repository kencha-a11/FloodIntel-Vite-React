import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './ui'

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void
  onError: (message: string) => void
}

export function CameraCapture({ onCapture, onError }: CameraCaptureProps) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    if (streamRef.current !== null) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current !== null) {
      videoRef.current.srcObject = null
    }
    setIsReady(false)
    setError(null)
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setIsReady(true)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to access the camera.'
      const reason =
        message.includes('secure context') || message.includes('HTTPS')
          ? 'Camera requires a secure connection (HTTPS). Please use the app over HTTPS.'
          : message.includes('permission') || message.includes('denied')
            ? 'Camera permission was denied. Please allow camera access to submit a flood report.'
            : message.includes('not found') || message.includes('devices')
              ? 'No camera was found on this device.'
              : `Camera error: ${message}`
      setError(reason)
      onError(reason)
    }
  }, [onError])

  useEffect(() => {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      const reason =
        'This browser does not support camera capture. Flood reporting requires camera access.'
      setError(reason)
      onError(reason)
    }
  }, [onError])

  const captureFrame = useCallback(() => {
    if (videoRef.current === null || streamRef.current === null || !isReady) {
      return
    }

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      const reason = 'Unable to create canvas for photo capture.'
      setError(reason)
      onError(reason)
      return
    }

    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          setError('Failed to encode the captured photo.')
          onError('Failed to encode the captured photo.')
          return
        }
        if (streamRef.current !== null) {
          streamRef.current.getTracks().forEach((track) => track.stop())
        }
        streamRef.current = null
        if (videoRef.current !== null) {
          videoRef.current.srcObject = null
        }
        setIsReady(false)
        onCapture(blob)
      },
      'image/jpeg',
      0.92,
    )
  }, [isReady, onCapture, onError])

  const retake = useCallback(() => {
    setError(null)
    void startCamera()
  }, [startCamera])

  if (error !== null && !isReady) {
    return (
      <div className="camera-error" role="alert">
        <p>{error}</p>
        <Button variant="quiet" onClick={startCamera}>
          Try again
        </Button>
        <p className="muted">
          There is no gallery or file-selection fallback. A live camera capture
          is required to submit a flood report.
        </p>
      </div>
    )
  }

  return (
    <div className="camera-capture">
      <div className="camera-preview">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ display: isReady ? 'block' : 'none' }}
        />
        {isReady && (
          <Button
            variant="primary"
            size="field"
            onClick={captureFrame}
            aria-label="Capture photo"
          >
            Capture
          </Button>
        )}
      </div>

      {!isReady && error === null && (
        <Button variant="secondary" onClick={() => void startCamera()}>
          Open camera
        </Button>
      )}
      {isReady && (
        <div className="camera-actions">
          <Button variant="quiet" onClick={cleanup} aria-label="Close camera">
            Close camera
          </Button>
          <Button variant="quiet" onClick={retake} aria-label="Retake photo">
            Retake
          </Button>
          <p className="muted">
            Point the camera at the flood scene, then tap Capture. The photo is
            taken live from the camera — gallery selection is not available.
          </p>
        </div>
      )}
    </div>
  )
}