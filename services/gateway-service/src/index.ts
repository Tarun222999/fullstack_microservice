try {
  await import('./tracing');
} catch (error) {
  console.error('Failed to load gateway telemetry; continuing without telemetry', error);
}

await import('./main');

export {};
