import { describe, expect, it, beforeEach } from '@jest/globals';
import { AutoSwagger } from '../src';
import { AutoSwaggerError } from '../src/errors';
import express from 'express';
import { Logger } from '../src/logger';

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
