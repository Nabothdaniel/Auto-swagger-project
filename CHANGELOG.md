# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Infer request and response schemas from handler types. `Request<P, ResBody, ReqBody>`, `Response<ResBody>`, `RequestHandler<...>` annotations, and `satisfies RequestHandler<...>` are resolved with the TypeScript checker for inline handlers, imported controllers, and handlers registered after middleware. Naming conventions remain the fallback for untyped handlers.
- Add the `inferHandlerTypes` option, enabled by default. Set it to `false` to skip handler resolution, which adds roughly two to three seconds to each scan.
- Add optional `requestSchema` and `responseSchema` fields to `RouteInfo`.

### Fixed

- Register named types that operations and other schemas refer to even when they are declared outside `routesDir`, so generated `$ref` entries resolve.
- Emit a `$ref` for a type that refers to itself instead of failing to generate its schema.

## [1.1.1] - 2026-09-21

### Fixed

- Report routes with the prefix of the router they are mounted on. `app.use('/api', router)` and nested `router.use()` calls are resolved through default, named, and `require` imports, and a router mounted more than once is documented under each prefix.
- Match request and response interfaces for prefixed routes by their resource segment, so `/api/products/{id}` still links `GetProductResponse`.

### Changed

- Tag operations by the first resource segment, skipping `api`, version segments such as `v1`, and path parameters. Routes declared as `/api/users` were tagged `api` and are now tagged `users`.

## [1.1.0] - 2026-09-21

### Added

- Add a `close()` method for explicit watcher cleanup.
- Export `AutoSwaggerError` and the public option and document types from the package entry point.
- Add an `exports` map to `package.json`. Deep imports such as `@nabothdaniel/express-auto-doc-ts/dist/errors` are no longer supported; import from the package root.
- Include a `LICENSE` file in the published package.

### Changed

- Reject `initialize()` with a `ROUTE_SCAN_ERROR` when a configured `routesDir` does not exist, instead of serving an empty document.
- Remove stale build output before each build and embed sources in the published source maps.

### Fixed

- Point the `types` entry at `dist/index.d.ts`. Versions 1.0.0 and 1.0.1 referenced a declaration file that was not published, so strict TypeScript projects failed with TS7016.
- Reference request and response interfaces from operations instead of emitting a bare `object` schema.
- Resolve request and response interfaces for singular and plural route names.
- Prevent watch mode from retaining untracked file watchers and refresh timers.
- Keep one Swagger UI middleware registration and serve the latest spec after a refresh.
- Resolve interfaces and type aliases structurally with ts-morph instead of string matching.
- Preserve literal unions, nested types, arrays, intersections, nullable fields, and `Partial` properties.
- Configure Jest and ESLint so the repository test and lint scripts run locally, and track `jest.config.js` so they also run in CI.
- Align the supported Node.js minimum with ts-morph and test current LTS lines in CI.

### Tests

- Assert generated OpenAPI paths and interface references for the sample users API.
- Assert that a missing `routesDir` rejects with `ROUTE_SCAN_ERROR`.

## [1.0.0] - 2025-11-10

### Added

- Initial release
- Automatic OpenAPI/Swagger documentation generation from Express routes
- TypeScript support with automatic type inference
- Watch mode for automatic documentation updates
- Multi-version API support
- Path filtering capabilities
- Custom schema support
- Security scheme configurations
- Built-in Swagger UI integration
