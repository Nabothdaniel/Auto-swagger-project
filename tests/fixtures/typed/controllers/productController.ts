import { Request, RequestHandler, Response } from 'express';
import { Product, ProductInput, ProductPatch } from '../types/product';

export const listProducts = (_req: Request, res: Response<Product[]>) => {
  res.json([]);
};

export const createProduct = (
  req: Request<Record<string, string>, Product, ProductInput>,
  res: Response<Product>
) => {
  res.json({ id: '1', createdAt: new Date(), ...req.body });
};

export const patchProduct: RequestHandler<{ id: string }, Product, ProductPatch> = (req, res) => {
  res.json({ id: req.params.id, createdAt: new Date(), name: 'n', price: 1, status: 'draft' });
};

export function untyped(_req: Request, res: Response) {
  res.json({});
}
