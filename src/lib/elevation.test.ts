import { describe, expect, it } from 'vitest'
import { createElevationSampler, parseDemHeader } from './elevation'

const HEADER_BYTES = 40

function buildGrid(
  width: number,
  height: number,
  cells: number[],
  derivedCells: number[] = cells.map(() => 0),
): { dem: Uint8Array; derived: Uint8Array } {
  const dem = new Uint8Array(HEADER_BYTES + width * height * 2)
  const derived = new Uint8Array(HEADER_BYTES + width * height)
  const view = new DataView(dem.buffer)

  view.setInt32(0, width, true)
  view.setInt32(4, height, true)
  view.setFloat64(8, 120.75, true)
  view.setFloat64(16, 14.95, true)
  view.setFloat64(24, 0.01, true)
  view.setFloat64(32, 0.01, true)

  cells.forEach((centimetres, index) => {
    view.setInt16(HEADER_BYTES + index * 2, centimetres, true)
  })

  derived.set(derivedCells, HEADER_BYTES)

  return { dem, derived }
}

describe('parseDemHeader', () => {
  it('reads the little-endian header', () => {
    const { dem } = buildGrid(2, 2, [0, 0, 0, -32768])

    expect(parseDemHeader(dem)).toEqual({
      width: 2,
      height: 2,
      originLon: 120.75,
      originLat: 14.95,
      lonRes: 0.01,
      latRes: 0.01,
    })
  })

  it('rejects a truncated header', () => {
    expect(() => parseDemHeader(new Uint8Array(16))).toThrow(/header/)
  })
})

describe('createElevationSampler', () => {
  const { dem, derived } = buildGrid(
    2,
    2,
    [-100, 250, -32768, 705],
    [0, 1, 0, 0],
  )
  const sampler = createElevationSampler(dem, derived)

  it('samples the north-west cell in metres', () => {
    expect(sampler.sample(120.755, 14.945)).toEqual({ elevationM: -1, derived: false })
  })

  it('samples the north-east cell and reports derived', () => {
    expect(sampler.sample(120.765, 14.945)).toEqual({ elevationM: 2.5, derived: true })
  })

  it('returns null, not zero, for nodata', () => {
    expect(sampler.sample(120.755, 14.935)).toEqual({ elevationM: null, derived: false })
  })

  it('returns null outside the grid', () => {
    expect(sampler.sample(120.7, 14.945)).toEqual({ elevationM: null, derived: false })
    expect(sampler.sample(120.755, 14.96)).toEqual({ elevationM: null, derived: false })
    expect(sampler.sample(Number.NaN, 14.945)).toEqual({ elevationM: null, derived: false })
  })

  it('is deterministic for a coordinate', () => {
    expect(sampler.sample(120.765, 14.935)).toEqual(sampler.sample(120.765, 14.935))
    expect(sampler.sample(120.765, 14.935).elevationM).toBe(7.05)
  })

  it('rejects a mask whose dimensions disagree', () => {
    expect(() => createElevationSampler(dem, new Uint8Array(HEADER_BYTES + 3))).toThrow(
      /derived mask/,
    )
  })
})
