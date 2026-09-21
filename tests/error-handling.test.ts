import { describe, expect, it, beforeEach } from '@jest/globals';
import { AutoSwagger, AutoSwaggerError } from '../src';
import express from 'express';

// Mock Logger to avoid console output during tests
jest.mock('../src/logger');

describe('AutoSwagger Error Handling', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    jest.clearAllMocks();
  });

  it('should throw error with invalid Express app', () => {
    expect(() => {
      new AutoSwagger(null as any);
    }).toThrow(AutoSwaggerError);

    expect(() => {
      new AutoSwagger({} as any);
    }).toThrow(AutoSwaggerError);
  });

  it('should handle invalid docsRoute', () => {
    expect(() => {
      new AutoSwagger(app, {
        docsRoute: '',
      });
    }).toThrow(AutoSwaggerError);
  });

  it('should reject a configured routesDir that does not exist', async () => {
    const swagger = new AutoSwagger(app, { routesDir: './missing-routes-dir' });
    swagger.on('error', () => undefined);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(swagger.initialize()).rejects.toMatchObject({
      code: AutoSwaggerError.CODES.ROUTE_SCAN_ERROR,
    });
    expect(swagger.getSpec()).toBeNull();

    consoleError.mockRestore();
  });

  it('should validate API version configuration', () => {
    expect(() => {
      new AutoSwagger(app, {
        apiVersions: [
          { version: '', basePath: '/api' }, // invalid version
        ],
      });
    }).toThrow(AutoSwaggerError);
  });
});
