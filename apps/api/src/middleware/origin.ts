/** Permit only the configured origin, plus its loopback alias in development. */
export function isAllowedOrigin(
  origin: string | undefined,
  appOrigin: string,
  environment: string,
): boolean {
  if (!origin) return false;
  if (origin === appOrigin) return true;
  if (environment !== 'development') return false;
  try {
    const requested = new URL(origin);
    const configured = new URL(appOrigin);
    const loopback = new Set(['localhost', '127.0.0.1']);
    return (
      requested.origin === origin &&
      loopback.has(requested.hostname) &&
      loopback.has(configured.hostname) &&
      requested.protocol === configured.protocol &&
      requested.port === configured.port
    );
  } catch {
    return false;
  }
}
