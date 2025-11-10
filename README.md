# Express Auto Swagger

Automatically generate OpenAPI/Swagger documentation from your Express routes with TypeScript support. This library analyzes your Express routes and TypeScript types to create comprehensive, up-to-date API documentation.

## Features

- 🚀 **Automatic Route Detection**: Automatically detects and documents Express routes
- 📝 **TypeScript Support**: Leverages TypeScript types for accurate schema generation
- 🔄 **Live Updates**: Watch mode for automatic documentation updates
- 🔢 **API Versioning**: Support for multiple API versions
- 🎯 **Path Filtering**: Include or exclude specific paths
- 🎨 **Custom Schemas**: Add custom schema definitions
- 🔐 **Security Schemes**: Configure API security requirements
- 📚 **Swagger UI Integration**: Built-in Swagger UI for testing and documentation

## Installation

```bash
npm install express-auto-swagger
# or
yarn add express-auto-swagger
```

## Quick Start

```typescript
import express from 'express';
import { AutoSwagger } from 'express-auto-swagger';

const app = express();

// Initialize Auto Swagger
const swagger = new AutoSwagger(app, {
  title: 'My API',
  version: '1.0.0',
  description: 'My API Description',
  docsRoute: '/api-docs',
});
```

## Configuration Options

The `AutoSwaggerOptions` interface supports the following options:

| Option            | Type                | Description                           |
| ----------------- | ------------------- | ------------------------------------- |
| `title`           | string              | API title displayed in Swagger UI     |
| `version`         | string              | API version                           |
| `description`     | string              | API description                       |
| `docsRoute`       | string              | Route where Swagger UI will be served |
| `debugMode`       | boolean             | Enable debug logging                  |
| `routesDir`       | string              | Directory containing route files      |
| `watchForChanges` | boolean             | Auto-refresh docs on file changes     |
| `apiVersions`     | ApiVersion[]        | Configure multiple API versions       |
| `excludePaths`    | string[]            | Paths to exclude from documentation   |
| `includeOnly`     | string[]            | Only include specified paths          |
| `customSchemas`   | Record<string, any> | Custom schema definitions             |
| `securitySchemes` | Record<string, any> | Security scheme configurations        |

## API Versioning

Support multiple API versions with different base paths:

```typescript
const swagger = new AutoSwagger(app, {
  apiVersions: [
    { version: '1', basePath: '/api/v1' },
    { version: '2', basePath: '/api/v2', description: 'Latest version' },
  ],
});
```

## Custom Schemas

Add custom schema definitions:

```typescript
const swagger = new AutoSwagger(app, {
  customSchemas: {
    Error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'number' },
      },
    },
  },
});
```

## Development

```bash
# Run development server
npm run dev
```

## Requirements

- Node.js >= 14
- Express >= 5.1.0
- TypeScript >= 5.0

## Dependencies

- express: ^5.1.0
- swagger-ui-express: ^5.0.1
- ts-morph: ^27.0.2

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
