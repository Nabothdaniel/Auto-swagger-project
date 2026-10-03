import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { AutoSwagger } from '../src';
import type { SwaggerSpec } from '../src';

jest.setTimeout(30000);

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const body = (operation: any) => operation.requestBody.content['application/json'].schema;
const ok = (operation: any) => operation.responses['200'].content['application/json'].schema;

async function generate(options: Record<string, unknown> = {}): Promise<SwaggerSpec> {
  const swagger = new AutoSwagger(express(), {
    routesDir: './tests/fixtures/typed/routes',
    ...options,
  });
  await swagger.initialize();
  return swagger.getSpec() as SwaggerSpec;
}

describe('handler type inference', () => {
  let spec: SwaggerSpec;
  let consoleLog: jest.SpyInstance;

  beforeAll(async () => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    spec = await generate();
  });

  afterAll(() => {
    consoleLog.mockRestore();
  });

  it('reads Request and Response generics from an imported controller', () => {
    const post = spec.paths['/products'].post;
    expect(body(post)).toEqual(ref('ProductInput'));
    expect(ok(post)).toEqual(ref('Product'));
  });

  it('documents an array response as an array of references', () => {
    expect(ok(spec.paths['/products'].get)).toEqual({ type: 'array', items: ref('Product') });
  });

  it('reads a RequestHandler annotation and references a type alias by name', () => {
    const patch = spec.paths['/products/{id}'].patch;
    expect(body(patch)).toEqual(ref('ProductPatch'));
    expect(ok(patch)).toEqual(ref('Product'));
  });

  it('reads an inline handler checked with satisfies', () => {
    expect(ok(spec.paths['/products/{id}'].get)).toEqual(ref('Product'));
  });

  it('registers referenced types that live outside routesDir', () => {
    const schemas = spec.components.schemas;
    expect(schemas.ProductInput).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        status: {
          oneOf: [
            { type: 'string', enum: ['draft'] },
            { type: 'string', enum: ['live'] },
          ],
        },
      },
      required: ['name', 'price', 'status'],
    });
    expect(schemas.Product.properties.createdAt).toEqual({ type: 'string', format: 'date-time' });
    expect(schemas.ProductPatch).toEqual({
      type: 'object',
      properties: { name: { type: 'string' }, price: { type: 'number' } },
    });
  });

  it('describes a type that refers to itself with references', () => {
    expect(spec.components.schemas.Category).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        parent: { ...ref('Category'), nullable: true },
        children: { type: 'array', items: ref('Category') },
      },
      required: ['name', 'children'],
    });
  });

  it('leaves untyped handlers with a plain object schema', () => {
    expect(ok(spec.paths['/untyped'].get)).toEqual({ type: 'object' });
  });

  it('never emits a reference without a matching schema', () => {
    const refs = JSON.stringify(spec).match(/#\/components\/schemas\/(\w+)/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    refs.forEach((entry) => {
      expect(spec.components.schemas).toHaveProperty(entry.split('/').pop() as string);
    });
  });
});

describe('inferHandlerTypes: false', () => {
  it('skips handler inference and keeps naming-convention matching', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const spec = await generate({ inferHandlerTypes: false });
    consoleLog.mockRestore();

    expect(body(spec.paths['/products'].post)).toEqual({ type: 'object' });
    expect(spec.components?.schemas?.Product).toBeUndefined();
  });
});
