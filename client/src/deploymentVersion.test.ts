import { describe, expect, it } from 'vitest'
import { deploymentVersion } from './deploymentVersion'

describe('deploymentVersion', () => {
  it('converts the short deployment commit from hexadecimal to decimal', () => {
    expect(deploymentVersion('1.0.0', undefined, 'abcdef0123456789')).toBe(
      '1.0.0+180150000',
    )
  })

  it('keeps an explicit app version unchanged', () => {
    expect(deploymentVersion('1.0.0', 'release-42', 'abcdef0')).toBe('release-42')
  })

  it('uses the package version for local builds or invalid commit refs', () => {
    expect(deploymentVersion('1.0.0', undefined, undefined)).toBe('1.0.0')
    expect(deploymentVersion('1.0.0', undefined, 'not-a-sha')).toBe('1.0.0')
  })
})
