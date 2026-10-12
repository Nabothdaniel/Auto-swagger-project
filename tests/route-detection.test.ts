import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { AutoSwagger } from '../src';
import type { SwaggerSpec } from '../src';

describe('route detection', () => {
  let spec: SwaggerSpec;
  let consoleLog: jest.SpyInstance;

  beforeAll(async () => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const swagger = new AutoSwagger(express(), {
      routesDir: './tests/fixtures/chained/routes',
      inferHandlerTypes: false,
    });
    await swagger.initialize();
    spec = swagger.getSpec() as SwaggerSpec;
  });

  afterAll(() => {
    consoleLog.mockRestore();
  });

  it('reports every method in a route() chain', () => {
    expect(Object.keys(spec.paths['/items/{id}']).sort()).toEqual(['delete', 'get']);
    expect(Object.keys(spec.paths['/orders']).sort()).toEqual(['get', 'post']);
  });

  it('detects routers with custom variable names', () => {
    expect(spec.paths['/health'].get).toBeDefined();
  });

  it('does not report calls that are not routes', () => {
    expect(Object.keys(spec.paths).sort()).toEqual(['/health', '/items/{id}', '/orders']);
  });

  it('keeps routes in source order', () => {
    expect(Object.keys(spec.paths['/items/{id}'])).toEqual(['get', 'delete']);
  });
});
