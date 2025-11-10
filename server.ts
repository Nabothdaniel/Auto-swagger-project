import express from 'express';
import userRoutes from './routes/userRoutes';
import { autoSwagger } from './src/index';

const app = express();
app.use(express.json());

// Mount all routers first
app.use(userRoutes);

// Initialize Swagger after mounting routes
autoSwagger(app, {
  title: 'My API',
  version: '1.0.0',
  description: 'My test doc',
  docsRoute: '/api-docs',
  debugMode: true, // Enable detailed logging
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
