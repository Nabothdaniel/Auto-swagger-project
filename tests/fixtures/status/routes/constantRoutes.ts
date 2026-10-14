import { Router } from 'express';
import type { Response } from 'express';
import { ACCEPTED, HttpStatus } from '../controllers/statusCodes';

const router = Router();
const UNPROCESSABLE = 422;

// Status sent through a shared helper typed with the whole enum: any member
// could be passed, so nothing is documented from it
const fail = (res: Response, status: HttpStatus) => res.status(status).json({});

router.post('/orders', (req, res) => {
  if (!req.body) return res.status(HttpStatus.BAD_REQUEST).json({});
  if (req.body.invalid) return res.status(UNPROCESSABLE).json({});
  res.status(HttpStatus.CREATED).json({ id: '1' });
});

router.put('/orders/:id', (req, res) => {
  res.status(req.body.created ? 201 : 200).json({});
});

router.post('/orders/:id/ship', (_req, res) => {
  res.sendStatus(ACCEPTED);
});

router.get('/orders/:id', (req, res) => {
  const status = req.params.id === 'missing' ? HttpStatus.NOT_FOUND : HttpStatus.OK;
  res.status(status).json({});
});

router.delete('/orders/:id', (_req, res) => {
  const code: number = 204;
  res.status(code).end();
});

router.patch('/orders/:id', (_req, res) => {
  fail(res, HttpStatus.CONFLICT);
});

router.get('/orders', (_req, res) => {
  const anyStatus = (status: HttpStatus) => res.status(status).json({});
  anyStatus(HttpStatus.OK);
});

export default router;
