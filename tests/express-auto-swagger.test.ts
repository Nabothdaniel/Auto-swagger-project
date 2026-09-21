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

  it('should expose generated OpenAPI paths and interface schemas', async () => {
    const swagger = new AutoSwagger(app, {
      routesDir: './routes',
      title: 'Users API',
      version: '2.0.0',
    });

    await swagger.initialize();
    const spec = swagger.getSpec();

    expect(spec?.info).toMatchObject({ title: 'Users API', version: '2.0.0' });
    expect(spec?.paths['/users']).toMatchObject({
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserRequest' },
            },
          },
        },
      },
    });
    expect(spec?.paths['/users/{id}'].get.responses['200'].content['application/json']).toEqual({
      schema: { $ref: '#/components/schemas/GetUserResponse' },
    });

    expect(spec?.components?.schemas.UserProfile).toEqual({
      type: 'object',
      properties: {
        role: {
          oneOf: [
            { type: 'string', enum: ['admin'] },
            { type: 'string', enum: ['member'] },
          ],
        },
        preferences: { $ref: '#/components/schemas/UserPreferences' },
        tags: { type: 'array', items: { type: 'string' } },
        note: { type: 'string', nullable: true },
      },
      required: ['role', 'preferences', 'tags'],
    });

    expect(spec?.components?.schemas.OptionalUser).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        age: { type: 'number' },
      },
    });
  });
});
