import express from 'express';
import { AutoSwagger } from '@nabothdaniel/express-auto-doc-ts';
import routes from './routes';

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const swagger = new AutoSwagger(app, {
    title: 'Users API',
    version: '1.0.0',
    description: 'Generated from the route files and TypeScript types in src/routes',
    routesDir: './src/routes',
    docsRoute: '/api-docs',
  });
  await swagger.initialize();

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`API running at http://localhost:${port}/api/users`);
    console.log(`Documentation at http://localhost:${port}/api-docs`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
