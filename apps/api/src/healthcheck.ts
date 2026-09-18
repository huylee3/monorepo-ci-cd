const port = process.env.PORT ?? '3001';

try {
  const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) {
    console.error(`API readiness check returned HTTP ${response.status}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error('API readiness check failed:', error);
  process.exitCode = 1;
}
