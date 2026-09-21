# Agent Instructions

## Project purpose

Express Auto Swagger generates an OpenAPI 3 document from Express routes and
TypeScript types. Keep the zero-manual-annotation workflow central to changes.

## Repository layout

- `src/index.ts`: public `AutoSwagger` class, route scanner, type scanner, and
  OpenAPI builder.
- `src/types/index.ts`: public option and generated-document types.
- `routes/`: sample route source scanned by tests and the development server.
- `tests/`: Jest regression and generated-spec tests.
- `server.ts`: local sample application.
- `dist/`: generated package output. Do not edit it by hand.

## Required checks

Run these commands before submitting a change:

```bash
npm ci
npm run lint
npm run build
npm test -- --runInBand
npm pack --dry-run
```

The same checks run in GitHub Actions on pushes to `main` and on pull requests.

## Change guidelines

1. Preserve the documented `AutoSwaggerOptions` API. Treat changes to public
   fields, defaults, generated OpenAPI shape, or exported types as compatibility
   changes that need tests and release notes.
2. Prefer ts-morph type predicates and resolved symbols over string matching.
   Type inference must distinguish optional properties from nullable values.
3. Add a generated-spec regression test for every scanner or schema behavior
   change. Assertions should inspect the OpenAPI object, not only whether the
   scanner completed.
4. Keep file watching bounded. Store watcher and timer handles, debounce
   refreshes, and release resources through `AutoSwagger.close()`.
5. Keep route scanning deterministic and avoid scanning `node_modules`, build
   output, coverage, tests, or declaration files.
6. Use ASCII in source and documentation unless a real user-facing requirement
   justifies another character set. Keep runtime logs concise and plain.
7. Do not commit generated `dist/` files unless the release process explicitly
   requires them. Do not edit files in `dist/` directly.

## Testing conventions

Use the existing Jest and ts-jest setup. Keep tests isolated from network calls
and external services. When watch mode is enabled in a test, call
`swagger.close()` in the test before it completes.

## Documentation and release notes

Update `README.md` when public behavior or setup changes. Add user-visible fixes
and features to the `[Unreleased]` section of `CHANGELOG.md`. Do not claim
support for a framework, validation library, or TypeScript feature without a
test that demonstrates the generated result.

## Pull requests

Explain the problem, the implementation boundary, and the verification commands.
Keep changes focused and avoid unrelated formatting or dependency upgrades.
Security issues belong in the private reporting process described in
`SECURITY.md`, not in a public issue.
