import { Router } from 'express';
import axios from 'axios';

const api = Router();
const lookup = new Map<string, string>();

// Chained route with two methods, registered on a custom router name
api
  .route('/items/:id')
  .get((_req, res) => res.json({}))
  .delete((_req, res) => res.status(204).end());

api.get('/health', (_req, res) => res.json({ ok: true }));

// Not routes: a Map lookup, an HTTP client call, and a settings read
lookup.get('/not-a-route');
axios.get('/also-not-a-route');
api.get('only-a-setting');

export default api;
