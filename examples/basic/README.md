# Basic example

A small Express 5 and TypeScript API documented by
`@nabothdaniel/express-auto-doc-ts`. There are no Swagger annotations anywhere in
the source.

```bash
cd examples/basic
npm install
npm start
```

Open <http://localhost:3000/api-docs>.

## What to look at

- `src/routes/userRoutes.ts` declares the routes as `/` and `/:id`.
- `src/routes/index.ts` mounts them under `/users`, and `src/app.ts` mounts that
  router under `/api`. The document reports `/api/users` and `/api/users/{id}`.
- `CreateUserRequest`, `CreateUserResponse`, and `GetUserResponse` are linked to
  the operations by naming convention and appear under `components.schemas`.
- `UserRole` becomes a `oneOf` of string literals, and `bio?: string | null`
  becomes an optional, nullable string.

Try it:

```bash
curl -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","role":"admin"}'
```
