# Contributing

Thanks for helping improve Express Auto Swagger.

## Local setup

```bash
npm ci
npm run lint
npm run build
npm test -- --runInBand
npm pack --dry-run
```

The sample app can be started with `npm run dev`. Keep changes focused on the
zero-manual-annotation experience and preserve the documented
`AutoSwaggerOptions` API.

## Workflow

1. Pick an issue, or open one first for anything larger than a small fix, and
   comment that you are working on it.
2. Fork the repository and create a branch from `main` using the naming rules
   below.
3. Make the change with a regression test. Scanner and schema changes need an
   assertion against the generated OpenAPI object.
4. Add a line under `[Unreleased]` in `CHANGELOG.md` for user-visible changes.
5. Open a pull request against `main` and fill in the template.

`main` is always releasable. Pull requests are squash merged, so the pull
request title becomes the commit on `main`.

## Branch names

Use `<type>/<short-description>` in lowercase kebab-case. Put the issue number
first when there is one.

| Pattern                  | Use for                                  | Example                        |
| ------------------------ | ---------------------------------------- | ------------------------------ |
| `feat/<description>`     | New behavior or options                  | `feat/57-enum-schema-support`  |
| `fix/<description>`      | Bug fixes                                | `fix/42-nullable-union-schema` |
| `docs/<description>`     | Documentation only                       | `docs/watch-mode-shutdown`     |
| `refactor/<description>` | Internal changes with no behavior change | `refactor/split-route-scanner` |
| `perf/<description>`     | Performance work                         | `perf/cache-ts-morph-project`  |
| `test/<description>`     | Tests only                               | `test/intersection-type-specs` |
| `ci/<description>`       | Workflows and automation                 | `ci/node-24-matrix`            |
| `chore/<description>`    | Tooling, dependencies, housekeeping      | `chore/upgrade-eslint`         |
| `release/v<version>`     | Release preparation, maintainers only    | `release/v1.1.0`               |

## Commit messages and pull request titles

Both follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <summary in the imperative, lowercase, no period>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

Scopes: `scanner`, `schema`, `watcher`, `ui`, `types`, `deps`, `ci`, `docs`,
`release`. Leave the scope out when a change spans several areas.

Examples:

```
fix(schema): keep nullable members of literal unions
feat(scanner): detect routes registered through nested routers
docs: describe watcher shutdown on SIGTERM
```

Mark a breaking change with `!` after the type or scope and explain it in a
`BREAKING CHANGE:` footer. Anything that changes public `AutoSwaggerOptions`
fields, defaults, exported types, or the generated OpenAPI shape counts.

A Husky `commit-msg` hook runs commitlint locally, and the `Conventions`
workflow checks the branch name and pull request title.

## Versioning

Releases follow [Semantic Versioning](https://semver.org/): `fix` produces a
patch release, `feat` a minor release, and a breaking change a major release.
Tags are named `v<version>`, for example `v1.1.0`.

## Labels

| Label              | Meaning                                                   |
| ------------------ | --------------------------------------------------------- |
| `bug`              | Incorrect scanner behavior or generated output            |
| `enhancement`      | New capability or option                                  |
| `documentation`    | README, guides, or examples                               |
| `good first issue` | Small, self-contained, with files and verification listed |
| `help wanted`      | Maintainers would welcome a pull request                  |
| `breaking`         | Requires a major version                                  |
| `needs repro`      | Waiting for a minimal route and type from the reporter    |

Issues labeled `good first issue` should be independently actionable and include
the expected behavior, relevant files, and a suggested verification command.

## Style

Use the repository Prettier configuration in `.prettierrc`. Husky and
`lint-staged` run checks for staged files. Avoid unrelated formatting changes.

## Pull requests

Describe the user-visible behavior, include regression tests for bug fixes, and
call out any API or generated-spec changes. Pull requests are reviewed for
correctness, backward compatibility, test coverage, and documentation impact.

Security issues belong in the private process described in
[SECURITY.md](SECURITY.md), not in a public issue or pull request.
