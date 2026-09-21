import { Router } from 'express';

export type UserRole = 'admin' | 'member';

export interface CreateUserRequest {
  name: string;
  email: string;
  role: UserRole;
}

export interface CreateUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface GetUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  bio?: string | null;
}

const users = new Map<string, GetUserResponse>();

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as CreateUserRequest;
  const user: CreateUserResponse = { id: String(users.size + 1), ...body };
  users.set(user.id, user);
  res.json(user);
});

router.get('/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(user);
});

export default router;
