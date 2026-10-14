import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import SwaggerParser from '@apidevtools/swagger-parser';
import { AutoSwagger } from '../src';
import type { AutoSwaggerOptions, SwaggerSpec } from '../src';

// Every fixture set the scanner is tested against, so a schema or $ref
// regression in any of them fails here even if its own assertions pass.
const FIXTURES: Array<[string, AutoSwaggerOptions]> = [
  ['sample routes', { routesDir: './routes' }],
  ['route() chains', { routesDir: './tests/fixtures/chained/routes' }],
  ['mounted routers', { routesDir: './tests/fixtures/mounted/routes' }],
  ['status codes', { routesDir: './tests/fixtures/status/routes' }],
  ['typed handlers', { routesDir: './tests/fixtures/typed/routes' }],
  [
    'typesDir',
    {
      routesDir: './tests/fixtures/types-dir/routes',
      typesDir: ['./tests/fixtures/types-dir/types', './tests/fixtures/types-dir/models'],
    },
  ],
];

async function generate(options: AutoSwaggerOptions): Promise<SwaggerSpec> {
  const swagger = new AutoSwagger(express(), options);
  await swagger.initialize();
  swagger.close();
  return swagger.getSpec() as SwaggerSpec;
}

describe('generated OpenAPI documents', () => {
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

  it('rejects a document with an unresolved $ref', async () => {
    const spec = await generate({ routesDir: './tests/fixtures/status/routes' });
    spec.paths['/users'].post.responses['201'].content['application/json'].schema = {
      $ref: '#/components/schemas/Missing',
    };
    await expect(SwaggerParser.validate(JSON.parse(JSON.stringify(spec)))).rejects.toThrow(
      /does not exist/
    );
  });

  describe.each([true, false])('with inferHandlerTypes %s', (inferHandlerTypes) => {
    it.each(FIXTURES)('%s are valid OpenAPI 3.0 with resolvable refs', async (_name, options) => {
      const spec = await generate({ ...options, inferHandlerTypes });
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);

      // validate() mutates its input while dereferencing, so pass a copy
      await expect(SwaggerParser.validate(JSON.parse(JSON.stringify(spec)))).resolves.toBeDefined();
    });
  });
});
