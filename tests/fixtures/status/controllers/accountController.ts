import { Request, Response } from 'express';

export const createAccount = (_req: Request, res: Response) => {
  res.status(201).json({ id: '1' });
};

export function removeAccount(_req: Request, res: Response) {
  res.sendStatus(204);
}
