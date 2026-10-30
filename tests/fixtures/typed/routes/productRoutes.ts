import { Router, RequestHandler } from 'express';
import {
  createProduct,
  getOrder,
  listProducts,
  patchProduct,
  untyped,
  untypedParam,
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
router.get('/orders/:status/:id', getOrder);
router.get('/items/:id', untypedParam);
router.get('/untyped', untyped);

export default router;
