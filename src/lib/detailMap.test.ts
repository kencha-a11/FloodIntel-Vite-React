import { describe, expect, it } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import {
  accuracyRing,
  describeAccuracy,
  describeGroundElevation,
  ringBounds,
} from './detailMap'

const CENTER: [number, number] = [120.8001, 14.9545]
const CELL = '≈29.9 m × 30.9 m cell at 14.95°'

function distanceMeters(a: [number, number], b: [number, number]): number {
  const radius = 6_371_008.8
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2

  return 2 * radius * Math.asin(Math.sqrt(h))
}

function ringOf(feature: Feature<Polygon> | null): [number, number][] {
  if (feature === null) {
    throw new Error('expected a ring')
  }

  return feature.geometry.coordinates[0] as [number, number][]
}

describe('accuracyRing', () => {
  it('closes a ring whose points sit on the recorded radius', () => {
    const ring = ringOf(accuracyRing(CENTER, 40, 32))

    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring[32])

    for (const point of ring) {
      expect(distanceMeters(CENTER, point)).toBeCloseTo(40, 0)
    }
  })

  it('bounds the circle around the report point', () => {
    const ring = accuracyRing(CENTER, 25, 64)

    if (ring === null) {
      throw new Error('expected a ring')
    }

    const [southWest, northEast] = ringBounds(ring)

    expect(southWest[0]).toBeLessThan(CENTER[0])
    expect(southWest[1]).toBeLessThan(CENTER[1])
    expect(northEast[0]).toBeGreaterThan(CENTER[0])
    expect(northEast[1]).toBeGreaterThan(CENTER[1])
    expect(northEast[0] - southWest[0]).toBeGreaterThan(0)
  })

  it('draws nothing without a usable accuracy', () => {
    expect(accuracyRing(CENTER, null)).toBeNull()
    expect(accuracyRing(CENTER, 0)).toBeNull()
    expect(accuracyRing(CENTER, -5)).toBeNull()
    expect(accuracyRing(CENTER, Number.NaN)).toBeNull()
  })
})

describe('describeAccuracy', () => {
  it('states the radius the device recorded', () => {
    expect(describeAccuracy(8)).toBe('±8 m')
    expect(describeAccuracy(8.4)).toBe('±8 m')
  })

  it('states the absence rather than a zero', () => {
    expect(describeAccuracy(null)).toBe('Not recorded')
    expect(describeAccuracy(Number.NaN)).toBe('Not recorded')
  })
})

describe('describeGroundElevation', () => {
  it('reports the sampled value as derived with its method and source', () => {
    const readout = describeGroundElevation({ elevationM: 4.204, derived: false }, CELL)

    expect(readout.value).toBe('4.20 m')
    expect(readout.note).toContain('Derived')
    expect(readout.note).toContain('nearest DEM cell')
    expect(readout.note).toContain(CELL)
    expect(readout.note).toContain('Copernicus DEM GLO-30')
    expect(readout.note).not.toContain('interpolated')
  })

  it('names an interpolated cell', () => {
    const readout = describeGroundElevation({ elevationM: 4.204, derived: true }, CELL)

    expect(readout.note).toContain('interpolated')
  })

  it('states nodata instead of inventing a height', () => {
    const readout = describeGroundElevation({ elevationM: null, derived: false }, CELL)

    expect(readout.value).toBe('Not recorded at this point')
    expect(readout.note).toContain('Derived')
    expect(readout.note).toContain('no value')
    expect(readout.note).toContain('Copernicus DEM GLO-30')
  })
})
