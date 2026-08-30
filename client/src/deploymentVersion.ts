export function deploymentVersion(
  packageVersion: string,
  override: string | undefined,
): string {
  return override ?? packageVersion
}
