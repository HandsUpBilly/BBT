import { describe, expect, it } from 'vitest'
import { deploymentVersion } from './deploymentVersion'

describe('deploymentVersion', () => {
  it('keeps an explicit app version unchanged', () => {
    expect(deploymentVersion('1.0.1', 'release-42')).toBe('release-42')
  })

  it('uses the package version when there is no explicit override', () => {
    expect(deploymentVersion('1.0.1', undefined)).toBe('1.0.1')
  })
})
