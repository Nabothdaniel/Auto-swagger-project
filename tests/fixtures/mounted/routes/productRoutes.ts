import { Router } from 'express';

export interface CreateProductRequest {
  name: string;
  price: number;
}

export interface CreateProductResponse {
  id: string;
  name: string;
  price: number;
}

export interface GetProductResponse {
  id: string;
  name: string;
  price: number;
}

const router = Router();

router.get('/', (_req, res) => {
  res.json([]);
});

router.post('/', (req, res) => {
  res.json({ id: '1', ...req.body });
});

router.get('/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Sample', price: 1 });
});

export default router;
