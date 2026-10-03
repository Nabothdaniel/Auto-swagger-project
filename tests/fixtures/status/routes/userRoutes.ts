import { Router } from 'express';
import { createAccount, removeAccount } from '../controllers/accountController';

const router = Router();
const pick = (): number => 202;
const asyncHandler = (fn: (req: any, res: any) => void) => fn;

router.post('/users', (req, res) => {
  res.status(201).json({ id: '1', ...req.body });
});

router.delete('/users/:id', (_req, res) => {
  res.status(204).end();
});

router.get('/users/:id', (req, res) => {
  if (req.params.id === 'missing') return res.status(404).json({ message: 'Not found' });
  res.json({ id: req.params.id });
});

router.post('/accounts', createAccount);
router.delete('/accounts/:id', removeAccount);
router.put(
  '/accounts/:id',
  asyncHandler(async (_req, res) => res.status(202).json({}))
);

// Computed status: not guessed, so the route keeps the default 200
router.get('/computed', (_req, res) => {
  res.status(pick()).json({});
});

router.get('/plain', (_req, res) => {
  res.json({});
});
