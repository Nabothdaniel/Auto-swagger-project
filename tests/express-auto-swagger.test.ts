import { AutoSwagger } from '../src';
import express from 'express';
import { AutoSwaggerError } from '../src/errors';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('AutoSwagger', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
  });

  it('should initialize with default options', () => {
    const swagger = new AutoSwagger(app);
    expect(swagger).toBeInstanceOf(AutoSwagger);
  });

  it('should throw error with invalid options', () => {
    expect(() => {
      new AutoSwagger(app, {
        docsRoute: '', // invalid empty route
      });
    }).toThrow(AutoSwaggerError);
  });

  it('should handle route scanning', async () => {
    const swagger = new AutoSwagger(app, {
      routesDir: './routes',
    });
    await expect(swagger.initialize()).resolves.not.toThrow();
  });
});
