import { Router } from 'express';

const router = Router();

router.post('/products', (req, res) => {
  res.json({ id: '1', ...req.body });
});

router.post('/orders', (req, res) => {
  res.json({ id: '1', ...req.body });
});

export default router;
