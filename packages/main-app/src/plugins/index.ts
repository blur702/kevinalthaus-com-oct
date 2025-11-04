import type express from 'express';

// Minimal no-op plugin discovery to avoid runtime crashes
export async function discoverPlugins(_app: express.Express): Promise<void> {
  // In a real implementation, scan a plugins directory and load manifests
  return Promise.resolve();
}

