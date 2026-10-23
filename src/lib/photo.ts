import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_EDGE,
  MIN_PHOTO_EDGE,
  PHOTO_QUALITY_STEPS,
  SAFE_PHOTO_BYTES,
  TARGET_PHOTO_BYTES,
} from './floodLevels'

export class PhotoDecodeError extends Error {
  constructor(message = 'This photo format is not supported on this device.') {
    super(message)
    this.name = 'PhotoDecodeError'
  }
}

export class PhotoTooLargeError extends Error {
  constructor(message = 'This photo could not be reduced below 5 MB.') {
    super(message)
    this.name = 'PhotoTooLargeError'
  }
}

export interface EncodeCandidate {
  edge: number
  quality: number
}

export interface PhotoProgress {
  stage: 'decoding' | 'encoding'
  edge?: number
  quality?: number
}

export interface CompressedPhoto {
  blob: Blob
  width: number
  height: number
  originalBytes: number
  bytes: number
  quality: number
  edge: number
  meetsTarget: boolean
}

interface DimensionedSource {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

export function buildEncodingPlan(longestEdge: number): EncodeCandidate[] {
  const floored = Math.max(1, Math.round(longestEdge))
  const startEdge = Math.max(
    MIN_PHOTO_EDGE,
    Math.min(MAX_PHOTO_EDGE, floored),
  )

  const plan: EncodeCandidate[] = []
  let edge = startEdge

  while (true) {
    for (const quality of PHOTO_QUALITY_STEPS) {
      plan.push({ edge, quality })
    }

    if (edge <= MIN_PHOTO_EDGE) {
      break
    }

    edge = Math.max(MIN_PHOTO_EDGE, Math.floor(edge / 2))
  }

  return plan
}

export function fitsBudget(
  candidate: { size: number },
  budget: number,
): boolean {
  return candidate.size > 0 && candidate.size <= budget
}

async function decodeImage(file: Blob): Promise<DimensionedSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      // Fall through to the <img> decoder.
    }
  }

  if (typeof Image === 'undefined') {
    throw new PhotoDecodeError()
  }

  const url = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url

    await image.decode()

    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw new PhotoDecodeError()
    }

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)

    if (err instanceof PhotoDecodeError) {
      throw err
    }

    throw new PhotoDecodeError()
  }
}

async function encodeJpeg(
  decoded: DimensionedSource,
  edge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(
    1,
    edge / Math.max(decoded.width, decoded.height),
  )
  const width = Math.max(1, Math.round(decoded.width * scale))
  const height = Math.max(1, Math.round(decoded.height * scale))

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')

    if (context === null) {
      throw new PhotoDecodeError('Unable to process the photo on this device.')
    }

    paint(context, decoded.source, width, height)

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    })

    return { blob, width, height }
  }

  if (typeof document === 'undefined') {
    throw new PhotoDecodeError()
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (context === null) {
    throw new PhotoDecodeError('Unable to process the photo on this device.')
  }

  paint(context, decoded.source, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })

  if (blob === null) {
    throw new PhotoDecodeError('Unable to process the photo on this device.')
  }

  return { blob, width, height }
}

function paint(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
): void {
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
}

export async function compressPhoto(
  file: Blob,
  options: {
    targetBytes?: number
    onProgress?: (progress: PhotoProgress) => void
  } = {},
): Promise<CompressedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoDecodeError('Only image files can be attached.')
  }

  const targetBytes = options.targetBytes ?? TARGET_PHOTO_BYTES
  const onProgress = options.onProgress

  onProgress?.({ stage: 'decoding' })

  const decoded = await decodeImage(file)

  try {
    const plan = buildEncodingPlan(Math.max(decoded.width, decoded.height))
    let smallestUnderCap: {
      blob: Blob
      width: number
      height: number
      candidate: EncodeCandidate
    } | null = null

    for (const candidate of plan) {
      onProgress?.({
        stage: 'encoding',
        edge: candidate.edge,
        quality: candidate.quality,
      })

      const encoded = await encodeJpeg(
        decoded,
        candidate.edge,
        candidate.quality,
      )

      const result = {
        ...encoded,
        originalBytes: file.size,
        bytes: encoded.blob.size,
        quality: candidate.quality,
        edge: candidate.edge,
      }

      if (fitsBudget({ size: encoded.blob.size }, targetBytes)) {
        return { ...result, meetsTarget: true }
      }

      if (
        encoded.blob.size <= SAFE_PHOTO_BYTES &&
        (smallestUnderCap === null ||
          encoded.blob.size < smallestUnderCap.blob.size)
      ) {
        smallestUnderCap = {
          ...encoded,
          candidate,
        }
      }
    }

    if (smallestUnderCap !== null) {
      return {
        blob: smallestUnderCap.blob,
        width: smallestUnderCap.width,
        height: smallestUnderCap.height,
        originalBytes: file.size,
        bytes: smallestUnderCap.blob.size,
        quality: smallestUnderCap.candidate.quality,
        edge: smallestUnderCap.candidate.edge,
        meetsTarget: false,
      }
    }

    throw new PhotoTooLargeError(
      `The photo is still larger than ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB after compression.`,
    )
  } finally {
    decoded.close()
  }
}
