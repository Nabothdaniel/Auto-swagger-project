import { Router } from 'express';

export const adminRouter = Router();

adminRouter.get('/stats', (_req, res) => {
  res.json({ users: 0 });
});
