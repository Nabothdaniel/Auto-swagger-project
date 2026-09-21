import express, { RequestHandler } from 'express';
import apiRouter from './routes';
import { adminRouter } from './routes/admin';

const requireAuth: RequestHandler = (_req, _res, next) => next();

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
app.use('/admin', requireAuth, adminRouter);

export default app;
