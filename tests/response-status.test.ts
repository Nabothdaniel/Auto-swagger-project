import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { AutoSwagger } from '../src';
import type { SwaggerSpec } from '../src';

async function generate(inferHandlerTypes: boolean): Promise<SwaggerSpec> {
  const swagger = new AutoSwagger(express(), {
    routesDir: './tests/fixtures/status/routes',
    inferHandlerTypes,
  });
  await swagger.initialize();
  return swagger.getSpec() as SwaggerSpec;
}

describe('response status codes', () => {
  let spec: SwaggerSpec;
  let consoleLog: jest.SpyInstance;

  beforeAll(async () => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    spec = await generate(true);
  });

  afterAll(() => {
    consoleLog.mockRestore();
  });

  it('documents 201 instead of 200 for a handler that creates', () => {
    const responses = spec.paths['/users'].post.responses;
    expect(Object.keys(responses)).toEqual(['201']);
    expect(responses['201'].description).toBe('Created');
    expect(responses['201'].content['application/json']).toBeDefined();
  });

  it('documents 204 without a content entry', () => {
    const responses = spec.paths['/users/{id}'].delete.responses;
    expect(responses).toEqual({ 204: { description: 'No Content' } });
  });

  it('documents every status code a handler sends', () => {
    const responses = spec.paths['/users/{id}'].get.responses;
    expect(Object.keys(responses)).toEqual(['200', '404']);
    expect(responses['200'].description).toBe('Success');
    expect(responses['200'].content['application/json']).toBeDefined();
    expect(responses['404']).toEqual({ description: 'Not Found' });
  });

  it('reads status codes from imported controllers', () => {
    expect(Object.keys(spec.paths['/accounts'].post.responses)).toEqual(['201']);
    expect(spec.paths['/accounts/{id}'].delete.responses).toEqual({
      204: { description: 'No Content' },
    });
  });

  it('reads status codes through a wrapper function', () => {
    expect(Object.keys(spec.paths['/accounts/{id}'].put.responses)).toEqual(['202']);
  });

  it('keeps the default 200 when the status is computed or absent', () => {
    ['/computed', '/plain'].forEach((route) => {
      const responses = spec.paths[route].get.responses;
      expect(Object.keys(responses)).toEqual(['200']);
      expect(responses['200'].content['application/json'].schema).toEqual({ type: 'object' });
    });
  });

  it('reads constants and enum members', () => {
    expect(Object.keys(spec.paths['/orders'].post.responses)).toEqual(['201', '400', '422']);
    expect(spec.paths['/orders'].post.responses['422'].description).toBe('Unprocessable Entity');
    const shipped = spec.paths['/orders/{id}/ship'].post.responses;
    expect(Object.keys(shipped)).toEqual(['202']);
    expect(shipped['202'].description).toBe('Accepted');
  });

  it('reads every branch of a conditional status', () => {
    expect(Object.keys(spec.paths['/orders/{id}'].put.responses)).toEqual(['200', '201']);
  });

  it('reads a variable whose type is a union of status codes', () => {
    expect(Object.keys(spec.paths['/orders/{id}'].get.responses)).toEqual(['200', '404']);
  });

  it('ignores a status typed as number or as a whole enum', () => {
    // `.end()` still means the request succeeds
    expect(Object.keys(spec.paths['/orders/{id}'].delete.responses)).toEqual(['200']);
    expect(Object.keys(spec.paths['/orders'].get.responses)).toEqual(['200']);
    expect(Object.keys(spec.paths['/orders/{id}'].patch.responses)).toEqual(['200']);
  });

  it('still reads inline handlers when handler type inference is off', async () => {
    const inline = await generate(false);
    expect(Object.keys(inline.paths['/users'].post.responses)).toEqual(['201']);
    // Imported controllers need the checker, so they keep the default
    expect(Object.keys(inline.paths['/accounts'].post.responses)).toEqual(['200']);
    // Literal conditionals are read from the syntax tree; constants need the checker
    expect(Object.keys(inline.paths['/orders/{id}'].put.responses)).toEqual(['200', '201']);
    expect(Object.keys(inline.paths['/orders'].post.responses)).toEqual(['200']);
  });
});
