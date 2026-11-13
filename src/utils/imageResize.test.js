import { describe, it, expect } from 'vitest'
import { computeTargetSize } from './imageResize'

describe('computeTargetSize', () => {
  it('leaves small images alone', () => expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 }))
  it('scales a landscape photo by its long edge, keeping the aspect ratio', () =>
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 }))
  it('scales a portrait receipt by its height', () =>
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 }))
  it('never upscales and tolerates a zero size', () => {
    expect(computeTargetSize(1600, 1600)).toEqual({ width: 1600, height: 1600 })
    expect(computeTargetSize(0, 0)).toEqual({ width: 0, height: 0 })
  })
  it('honours a custom limit', () => expect(computeTargetSize(1000, 500, 200)).toEqual({ width: 200, height: 100 }))
})
