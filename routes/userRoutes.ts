import { Router, Request, Response } from 'express';

export interface CreateUserRequest {
  name: string;
  age: number;
}

export interface CreateUserResponse {
  id: string;
  name: string;
  age: number;
}

export interface GetUserResponse {
  id: string;
  name: string;
  age: number;
}

const router = Router();

router.post(
  '/users',
  (req: Request<{}, {}, CreateUserRequest>, res: Response<CreateUserResponse>) => {
    const { name, age } = req.body;
    res.json({ id: '123', name, age });
  }
);

router.get('/users/:id', (req: Request<{ id: string }>, res: Response<GetUserResponse>) => {
  const { id } = req.params;
  res.json({ id, name: 'John Doe', age: 30 });
});

export default router;
