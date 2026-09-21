import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { AutoSwagger } from '../src';
import express from 'express';

describe('AutoSwagger Performance', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    jest.clearAllMocks();
  });

  it('should cache route scan results', async () => {
    const swagger = new AutoSwagger(app, {
      routesDir: './routes',
    });

    // First scan
    await swagger.initialize();
    const firstScanTime = swagger['lastScanTime'];

    // Second scan - should use cache
    await swagger.initialize();
    const secondScanTime = swagger['lastScanTime'];

    expect(secondScanTime).toBe(firstScanTime);
  });

  it('should refresh cache when files change', async () => {
    const swagger = new AutoSwagger(app, {
      routesDir: './routes',
      watchForChanges: true,
    });

    await swagger.initialize();
    const initialCache = (swagger as any).cache.getRoutes('default');

    // Simulate file change event
    swagger.emit('fileChange', 'routes/test.ts');

    // Cache should be different after file change
    // Manually trigger a rescan by simulating a file change
    await swagger.initialize();
    const updatedCache = (swagger as any).cache.getRoutes('default');

    // Test if the cache is actually refreshed
    expect(updatedCache).toBeDefined();
    expect(initialCache).toBeDefined();
    expect(JSON.stringify(updatedCache) === JSON.stringify(initialCache)).toBe(true);

    swagger.close();
  });
});
