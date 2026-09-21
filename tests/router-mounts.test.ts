import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { AutoSwagger } from '../src';
import { joinRoutePath } from '../src/mounts';
import type { SwaggerSpec } from '../src';

describe('router mount prefixes', () => {
  let spec: SwaggerSpec;
  let consoleLog: jest.SpyInstance;

  beforeAll(async () => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const swagger = new AutoSwagger(express(), {
      routesDir: './tests/fixtures/mounted/routes',
    });
    await swagger.initialize();
    spec = swagger.getSpec() as SwaggerSpec;
  });

  afterAll(() => {
    consoleLog.mockRestore();
  });

  it('prefixes routes with every level of app.use and router.use', () => {
    expect(Object.keys(spec.paths).sort()).toEqual([
      '/admin/stats',
      '/api/products',
      '/api/products/{id}',
    ]);
    expect(Object.keys(spec.paths['/api/products']).sort()).toEqual(['get', 'post']);
  });

  it('resolves named router imports mounted behind middleware', () => {
    expect(spec.paths['/admin/stats'].get).toBeDefined();
    expect(spec.paths['/stats']).toBeUndefined();
  });

  it('tags operations by resource instead of the mount prefix', () => {
    expect(spec.paths['/api/products'].get.tags).toEqual(['products']);
    expect(spec.paths['/admin/stats'].get.tags).toEqual(['admin']);
  });

  it('still links interfaces by convention for prefixed routes', () => {
    const post = spec.paths['/api/products'].post;
    expect(post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateProductRequest',
    });
    expect(post.responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateProductResponse',
    });
    expect(
      spec.paths['/api/products/{id}'].get.responses['200'].content['application/json'].schema
    ).toEqual({ $ref: '#/components/schemas/GetProductResponse' });
  });

  it('documents path parameters that come from the route', () => {
    expect(spec.paths['/api/products/{id}'].get.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ]);
  });
});

describe('joinRoutePath', () => {
  it.each([
    ['', '/users', '/users'],
    ['/api', '/', '/api'],
    ['/api/', '/users/', '/api/users'],
    ['/api', 'users', '/api/users'],
    ['', '/', '/'],
    ['', '', '/'],
  ])('joins %p and %p into %p', (prefix, routePath, expected) => {
    expect(joinRoutePath(prefix, routePath)).toBe(expected);
  });
});
