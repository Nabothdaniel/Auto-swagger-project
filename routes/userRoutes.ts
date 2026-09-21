import { Router, RequestHandler } from 'express';

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

export type UserRole = 'admin' | 'member';

export interface UserPreferences {
  newsletter: boolean;
}

export interface UserProfile {
  role: UserRole;
  preferences: UserPreferences;
  tags: string[];
  note?: string | null;
}

export type OptionalUser = Partial<CreateUserResponse>;

const router = Router();

router.post(
  '/users',
  ((req, res) => {
    const { name, age } = req.body;
    res.json({ id: '123', name, age });
  }) satisfies RequestHandler<Record<string, string>, CreateUserResponse, CreateUserRequest>
);

router.get(
  '/users/:id',
  ((req, res) => {
    const { id } = req.params;
    res.json({ id, name: 'John Doe', age: 30 });
  }) satisfies RequestHandler<{ id: string }, GetUserResponse>
);

export default router;
