# Express Auto Swagger

Express Auto Swagger generates an OpenAPI 3 document from an Express and TypeScript codebase. It scans route files, resolves TypeScript interfaces and type aliases, builds request and response schemas, and serves Swagger UI from your application.

The goal is to keep API documentation close to the code that defines the API. You write ordinary Express routes and TypeScript types. The package turns them into a usable specification without requiring a second set of hand-written annotations.

## What it provides

- Route discovery for TypeScript and JavaScript files in common route folders.
- Schema generation from interfaces and type aliases, including arrays, unions, intersections, nested types, literal values, nullable fields, and common utility types such as `Partial`.
- Request and response references based on conventional names such as `CreateUserRequest` and `GetUserResponse`.
- Include and exclude filters for generated paths.
- Multiple server definitions, API version metadata, custom schemas, and security schemes.
- Swagger UI mounted inside the Express application.
- Optional file watching for local development.

## Requirements

- Node.js 18 or newer. Node.js 22 or 24 is recommended for development.
- Express 4.17 or newer. Express 5 is supported and recommended for new applications.
- TypeScript 5 or newer in the application being scanned.

## Installation

```bash
npm install @nabothdaniel/express-auto-doc-ts
```

Express is a peer dependency and should already be installed in your project.

## Quick start

Mount your routes before initializing the documentation generator. The scanner reads the source files on disk, so `routesDir` should point to the directory containing those files.

```typescript
import express from 'express';
import { AutoSwagger } from '@nabothdaniel/express-auto-doc-ts';

interface CreateUserRequest {
  name: string;
  age: number;
}

interface CreateUserResponse {
  id: string;
  name: string;
  age: number;
}

const app = express();
app.use(express.json());

app.post(
  '/users',
  (req: express.Request<{}, {}, CreateUserRequest>, res: express.Response<CreateUserResponse>) => {
    res.status(201).json({
      id: 'user-123',
      name: req.body.name,
      age: req.body.age,
    });
  }
);

const swagger = new AutoSwagger(app, {
  title: 'Users API',
  version: '1.0.0',
  description: 'Example user service',
  routesDir: './routes',
  docsRoute: '/api-docs',
});

await swagger.initialize();

app.listen(3000, () => {
  console.log('API running at http://localhost:3000');
  console.log('Documentation available at http://localhost:3000/api-docs');
});
```

Open `http://localhost:3000/api-docs` to view the generated documentation.

## Mounted routers

Routes are documented with the full path they are served from. Prefixes passed to `app.use()` and nested `router.use()` calls are combined with the route path:

```typescript
// src/routes/productRoutes.ts
router.get('/:id', getProduct);

// src/routes/index.ts
router.use('/products', productRoutes);

// src/app.ts
app.use('/api', routes);
```

This produces `/api/products/{id}`, tagged `products`. The scanner reads the route files plus the files directly inside each directory between `routesDir` and the working directory, which is where `app.ts`, `server.ts`, or `index.ts` normally live. An entry point kept elsewhere, a prefix built from a variable, and routers created by a factory function are not resolved; those routes keep the path declared in the route file.

## How type inference works

The scanner uses ts-morph to resolve types instead of looking for words in a type's printed text. This means the following declarations produce meaningful OpenAPI schemas:

```typescript
type UserRole = 'admin' | 'member';

interface Profile {
  role: UserRole;
  tags: string[];
  preferences: {
    newsletter: boolean;
  };
  note?: string | null;
}

type EditableProfile = Partial<Profile>;
```

The generated document represents literal unions with `oneOf`, arrays with `items`, nested named types with component references, and explicit `null` members with `nullable: true`. An optional property is not automatically nullable; those are different concepts in OpenAPI.

## Configuration

`AutoSwaggerOptions` supports these fields:

| Option            | Type                  | Description                                                                                   |
| ----------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `title`           | `string`              | Title displayed in the specification and Swagger UI.                                          |
| `version`         | `string`              | API version placed in the OpenAPI `info` object.                                              |
| `description`     | `string`              | API description.                                                                              |
| `docsRoute`       | `string`              | Express path where Swagger UI is mounted. Defaults to `/docs`.                                |
| `debugMode`       | `boolean`             | Enables diagnostic logging during scanning and refreshes.                                     |
| `routesDir`       | `string`              | Directory to scan. Defaults to common `routes`, `src/routes`, `src/api`, and `api` locations. |
| `servers`         | `ServerConfig[]`      | Server URLs included in the generated document.                                               |
| `watchForChanges` | `boolean`             | Rescans source files after changes during development.                                        |
| `apiVersions`     | `ApiVersion[]`        | Version metadata with a version and base path.                                                |
| `excludePaths`    | `string[]`            | Excludes generated paths containing any listed value.                                         |
| `includeOnly`     | `string[]`            | Includes only generated paths containing any listed value.                                    |
| `customSchemas`   | `Record<string, any>` | Adds schemas directly to `components.schemas`.                                                |
| `securitySchemes` | `Record<string, any>` | Adds entries to `components.securitySchemes`.                                                 |

Example configuration:

```typescript
const swagger = new AutoSwagger(app, {
  title: 'Orders API',
  version: '2.0.0',
  docsRoute: '/api-docs',
  routesDir: './src/routes',
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://api.example.com', description: 'Production' },
  ],
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
});
```

## Refreshing and shutting down

Initialization is asynchronous:

```typescript
await swagger.initialize();
```

You can rescan the source files after a change:

```typescript
await swagger.refresh();
```

When watch mode is enabled, close the watcher during application shutdown:

```typescript
process.on('SIGTERM', () => {
  swagger.close();
});
```

The same instance keeps the Swagger UI route registered and updates the served specification after a refresh.

## Error handling

Configuration and scanning failures throw `AutoSwaggerError`, which carries a `code` property. If `routesDir` is set to a directory that does not exist, `initialize()` rejects with the `ROUTE_SCAN_ERROR` code instead of serving an empty document.

```typescript
import { AutoSwagger, AutoSwaggerError } from '@nabothdaniel/express-auto-doc-ts';

try {
  await swagger.initialize();
} catch (error) {
  if (error instanceof AutoSwaggerError) {
    console.error(error.code, error.message);
  }
}
```

The option and document types (`AutoSwaggerOptions`, `ServerConfig`, `ApiVersion`, `RouteInfo`, `SwaggerSpec`) are exported from the package entry point.

## Why not swagger-jsdoc or swagger-autogen?

Those tools are useful when documentation is driven by comments or explicit annotations. Express Auto Swagger is intended for teams that want TypeScript types to be the primary source of request and response schemas.

| Tool                 | Primary input                                | Typical workflow                                     |
| -------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Express Auto Swagger | Express routes and TypeScript types          | Define routes and types; generate the document.      |
| swagger-jsdoc        | JSDoc annotations plus an OpenAPI definition | Maintain documentation comments beside handlers.     |
| swagger-autogen      | Route source and optional annotations        | Infer route structure, then refine generated output. |
| NestJS Swagger       | Nest decorators and metadata                 | Add decorators to controllers and DTOs.              |

For example, a manually documented approach may require an annotation block:

```typescript
/**
 * @swagger
 * /users:
 *   post:
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 */
```

With Express Auto Swagger, the route and TypeScript request type remain the source of truth. The tradeoff is that the package follows naming conventions and currently focuses on Express rather than supporting every framework.

## Development

```bash
npm install
npm test -- --runInBand
npm run lint
npm run build
npm run dev
```

The sample application serves its UI at `/api-docs`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the review and contribution process.

## Reporting issues

For a bug, include a minimal route, the relevant TypeScript type, generated OpenAPI output, Node.js version, and package version. Security issues should be reported privately according to [SECURITY.md](SECURITY.md).

Release history is recorded in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
