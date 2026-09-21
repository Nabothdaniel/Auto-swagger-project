# Contributing

Thanks for helping improve Express Auto Swagger.

## Local setup

```bash
npm install
npm test
npm run lint
npm run build
```

The sample app can be started with `npm run dev`. Keep changes focused on the
zero-manual-annotation experience and preserve the documented
`AutoSwaggerOptions` API.

## Style

Use the repository Prettier configuration in `.prettierrc`. Husky and
`lint-staged` run checks for staged files. Avoid unrelated formatting changes.

## Pull requests

Describe the user-visible behavior, include regression tests for bug fixes, and
call out any API or generated-spec changes. Pull requests are reviewed for
correctness, backward compatibility, test coverage, and documentation impact.

Issues labeled `good first issue` should be independently actionable and include
the expected behavior, relevant files, and a suggested verification command.
