# Agent Prompt: Harden & Grow `express-auto-swagger`

Paste this to a coding agent (Codex, Claude Code, etc.) with repo access to `https://github.com/Nabothdaniel/Auto-swagger-project`.

---

## Context

`express-auto-swagger` is a published npm package (10 months live, peaked at 172 weekly downloads) that auto-generates OpenAPI/Swagger documentation from Express routes and TypeScript types, using `ts-morph` for AST-based type introspection. It is inspired by FastAPI's built-in auto-docs experience. The maintainer has been away from the project and wants to relaunch it, grow adoption toward 1,000 weekly downloads, and attract contributors/a co-maintainer.

Current repo structure (as of last check):
```
.husky/
routes/
src/
tests/
usage/
.gitignore
.lintstagedrc
.prettierrc
CHANGELOG.md
README.md
package.json
server.ts
tsconfig.json
```
Core API surface: `new AutoSwagger(app, options)` with options for `title`, `version`, `description`, `docsRoute`, `debugMode`, `routesDir`, `watchForChanges`, `apiVersions`, `excludePaths`, `includeOnly`, `customSchemas`, `securitySchemes`. Peer deps: `express@^5.1.0`, `swagger-ui-express@^5.0.1`, `ts-morph@^27.0.2`, TypeScript `>=5.0`, Node `>=14`.

## Your task

Audit the existing codebase first, then implement improvements across the areas below. Do not break the existing public API (`AutoSwaggerOptions`) without a documented migration path and a major version bump. Open changes as separate, reviewable commits/PRs grouped by theme, not one giant commit.

### 1. Correctness & robustness (highest priority)
- Review the `ts-morph`-based type introspection in `src/` for edge cases: generics, union/intersection types, enums, `Omit`/`Pick`/`Partial` wrappers, recursive types, and types imported from `node_modules` (e.g., Prisma or Zod-generated types). Identify and fix silent failures (routes that get skipped or mis-typed without warning).
- Add defensive error handling: if a route or type can't be parsed, log a clear warning (respecting `debugMode`) naming the file/route instead of crashing or silently omitting it.
- Verify behavior with Express 5's routing changes specifically (the README requires `express@^5.1.0`) — confirm route detection works with Express 5 error-handling middleware signatures and the new path-matching syntax.
- Check `watchForChanges` mode for memory leaks or stale-cache bugs on long-running dev servers.

### 2. Test coverage
- Inspect the existing `tests/` folder and report current coverage (add `c8` or `vitest --coverage` if no tool is configured).
- Add integration tests that spin up a real Express app with representative routes (basic CRUD, nested routers, middleware-wrapped routes, versioned APIs via `apiVersions`) and assert on the generated OpenAPI JSON output, not just that it doesn't throw.
- Add regression tests for every bug fixed under item 1.
- Add a CI workflow (GitHub Actions) that runs lint, typecheck, and tests on every PR and push to `main`, across at least two Node LTS versions.

### 3. Developer experience & onboarding
- Expand `README.md` with: a short GIF or terminal-recording (e.g., via `vhs` or `terminalizer`) showing Swagger UI generated from a sample app; a "Why not X" comparison table against `swagger-jsdoc` and `swagger-autogen` (manual annotations vs. automatic type inference is the differentiator — make it concrete with a side-by-side code snippet).
- Add a minimal, runnable example app under `usage/` or a new `examples/` folder (basic Express + TS CRUD API) that a newcomer can `npm install && npm run dev` and see working docs at `/api-docs` within a minute.
- Add a `CONTRIBUTING.md`: local setup, how to run tests, coding style (reference `.prettierrc`/`.lintstagedrc`/`.husky` already in place), how PRs are reviewed, and a "good first issue" labeling convention.
- Add a `CODE_OF_CONDUCT.md` (standard Contributor Covenant is fine) — small thing, but signals the project welcomes outside contributors.
- Add badges to the README: npm version, weekly downloads, build status, license, TypeScript.

### 4. API surface & feature gaps (survey competitors first)
Before building, briefly compare against `swagger-jsdoc`, `swagger-autogen`, and NestJS's built-in Swagger module to identify feature gaps worth closing. Candidates to evaluate and implement where they clearly fit the "zero-manual-annotation" philosophy:
- Automatic request/response example generation from TypeScript types (not just schemas).
- Support for common validation libraries (Zod, class-validator, Joi) so their schemas/refinements are reflected in the generated OpenAPI spec, since many Express+TS projects already use one of these.
- Optional adapters/plugins for Fastify and NestJS to widen the addressable audience beyond Express (only after Express support is rock-solid — don't spread thin).
- A CLI command (`npx express-auto-swagger init`) that scaffolds the setup into an existing Express+TS project, lowering the barrier to trying it.

### 5. Release hygiene & trust signals
- Ensure `CHANGELOG.md` is kept current using a convention (Keep a Changelog format or `changesets`).
- Add semantic-release or `changesets` for automated versioning/publishing so releases are frequent and low-friction, which correlates with higher perceived project health.
- Add a `SECURITY.md` with a disclosure process — small but meaningful for any package that touches route/type introspection.
- Tag a proper GitHub Release for the next version bump with real release notes (currently repo shows 1 commit and no releases — this is one of the first things potential adopters and reviewers check).

### 6. Growth mechanics (secondary to code quality, but relevant to the 1k-download goal)
- Ensure the npm package README (via `npm publish`) matches the GitHub README quality, since that's often the first thing evaluators/users see.
- Add the repo to relevant `awesome-express` / `awesome-typescript` lists via PR if it meets their inclusion bar.
- Add GitHub Topics (`express`, `typescript`, `openapi`, `swagger`, `api-documentation`) so it surfaces in GitHub search.
- Open 3-5 well-scoped "good first issue" tickets now, so incoming interest from a launch post has somewhere concrete to land.

## Deliverables

Provide, in order:
1. A short audit report of current bugs/gaps found under items 1-2.
2. A prioritized PR plan (which items ship first) — correctness and tests before new features.
3. Implementation, as separate commits/PRs per theme, each with a clear description.
4. An updated README and CHANGELOG reflecting everything shipped.

## Constraints
- Preserve backward compatibility with the documented `AutoSwaggerOptions` API unless a breaking change is explicitly called out and version-bumped accordingly.
- Keep the zero-manual-annotation philosophy central — don't add features that require the same manual doc-writing burden this package exists to eliminate.
- Favor small, mergeable, well-tested PRs over one large rewrite.
