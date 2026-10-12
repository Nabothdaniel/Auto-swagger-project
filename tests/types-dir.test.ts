import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { AutoSwagger } from '../src';
import type { AutoSwaggerOptions, SwaggerSpec } from '../src';

const FIXTURE = './tests/fixtures/types-dir';

async function generate(options: AutoSwaggerOptions): Promise<SwaggerSpec> {
  const swagger = new AutoSwagger(express(), {
    routesDir: `${FIXTURE}/routes`,
    inferHandlerTypes: false,
    ...options,
  });
  await swagger.initialize();
  swagger.close();
  return swagger.getSpec() as SwaggerSpec;
}

describe('typesDir option', () => {
  let consoleLog: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;

  beforeAll(() => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  });

  it('finds no schemas when types live outside routesDir and typesDir is not set', async () => {
    const spec = await generate({});
    expect(spec.components?.schemas ?? {}).toEqual({});
    expect(spec.paths['/products'].post.requestBody.content['application/json'].schema).toEqual({
      type: 'object',
    });
  });

  it('registers types from typesDir and links them to operations', async () => {
    const spec = await generate({ typesDir: `${FIXTURE}/types` });

    expect(Object.keys(spec.components.schemas).sort()).toEqual([
      'CreateProductRequest',
      'CreateProductResponse',
    ]);
    const post = spec.paths['/products'].post;
    expect(post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateProductRequest',
    });
    expect(post.responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateProductResponse',
    });
  });

  it('accepts several directories', async () => {
    const spec = await generate({ typesDir: [`${FIXTURE}/types`, `${FIXTURE}/models`] });

    expect(Object.keys(spec.components.schemas).sort()).toEqual([
      'CreateOrderRequest',
      'CreateOrderResponse',
      'CreateProductRequest',
      'CreateProductResponse',
    ]);
    expect(spec.paths['/orders'].post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateOrderRequest',
    });
  });

  it('never scans coverage output or declaration files', async () => {
    const spec = await generate({ typesDir: `${FIXTURE}/types` });

    expect(spec.components.schemas.CoverageReport).toBeUndefined();
    expect(spec.components.schemas.GeneratedDeclaration).toBeUndefined();
  });

  it('warns about a missing directory without failing', async () => {
    const spec = await generate({ typesDir: [`${FIXTURE}/missing`, `${FIXTURE}/types`] });

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Types directory not found'));
    expect(spec.components.schemas.CreateProductRequest).toBeDefined();
  });
});
