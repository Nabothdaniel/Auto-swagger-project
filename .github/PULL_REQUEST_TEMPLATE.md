<!-- Title format: <type>(<optional scope>): <summary>, for example "fix(schema): keep nullable union members" -->

## Problem

<!-- What is wrong or missing today? Link the issue: Closes #123 -->

## Implementation boundary

<!-- What this change touches and what it deliberately leaves alone. -->

## Generated OpenAPI impact

<!-- Paste the before and after spec fragment, or write "None". -->

## Verification

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test -- --runInBand`
- [ ] `npm pack --dry-run`

## Checklist

- [ ] A generated-spec regression test covers any scanner or schema behavior change.
- [ ] `README.md` is updated if public behavior or setup changed.
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` for user-visible changes.
- [ ] No files in `dist/` were edited or committed.
