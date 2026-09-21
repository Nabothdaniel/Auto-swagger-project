# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
