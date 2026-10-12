import { Router, RequestHandler } from 'express';
import {
  createProduct,
  listProducts,
  patchProduct,
  untyped,
} from '../controllers/productController';
import { Product } from '../types/product';

export interface Category {
  name: string;
  parent?: Category | null;
  children: Category[];
}

const requireAuth: RequestHandler = (_req, _res, next) => next();

const router = Router();

router.get('/products', listProducts);
router.post('/products', requireAuth, createProduct);
router.patch('/products/:id', patchProduct);
router.get('/products/:id', ((req, res) => {
  res.json({ id: req.params.id, createdAt: new Date(), name: 'n', price: 1, status: 'live' });
}) satisfies RequestHandler<{ id: string }, Product>);
router.get('/untyped', untyped);

export default router;
