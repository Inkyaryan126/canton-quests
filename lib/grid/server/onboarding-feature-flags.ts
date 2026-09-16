export function isGridOnboardingWriteEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.GRID_FOUNDATION_ENABLED === '1' &&
    env.GRID_ONBOARDING_WRITE_ENABLED === '1'
  );
}
