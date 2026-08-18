export function deploymentVersion(
  packageVersion: string,
  override: string | undefined,
  commitRef: string | undefined,
): string {
  if (override !== undefined) return override
  if (!commitRef) return packageVersion

  const shortRef = commitRef.slice(0, 7)
  if (!/^[0-9a-f]+$/i.test(shortRef)) return packageVersion

  return `${packageVersion}+${Number.parseInt(shortRef, 16).toString(10)}`
}
