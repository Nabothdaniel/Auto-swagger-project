/**
 * 
 * import { AutoSwagger } from '@nabothdaniel/express-auto-doc-ts';

const swagger = new AutoSwagger(app, {
  title: 'My API',
  version: '2.0.0',
  debugMode: true,
  watchForChanges: true, // Auto-refresh on file changes!
  
  // Multi-versioning
  apiVersions: [
    { version: '1', basePath: '/api/v1' },
    { version: '2', basePath: '/api/v2' }
  ],
  
  // Filtering
  excludePaths: ['/internal', '/admin'],
  includeOnly: ['/api'],
  
  // Custom schemas
  customSchemas: {
    Error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'number' }
      }
    }
  },
  
  // Security
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    }
  },
  
  // Servers
  servers: [
    { url: 'http://localhost:3000', description: 'Dev' },
    { url: 'https://api.prod.com', description: 'Production' }
  ]
});

await swagger.initialize();

// Listen to events
swagger.on('initialized', ({ routes, interfaces }) => {
  console.log(`Loaded ${routes.length} routes`);
});

swagger.on('error', (error) => {
  console.error('Swagger error:', error);
});

// Manually refresh
app.post('/admin/refresh-docs', async (req, res) => {
  await swagger.refresh();
  res.json({ message: 'Docs refreshed' });
});

// Get spec programmatically
const spec = swagger.getSpec();
 */
