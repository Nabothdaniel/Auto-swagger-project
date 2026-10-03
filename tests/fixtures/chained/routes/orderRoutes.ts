import express from 'express';

const orders = express.Router();

orders
  .route('/orders')
  .get((_req, res) => res.json([]))
  .post((_req, res) => res.json({}));

export default orders;
