export interface CreateOrderRequest {
  productId: string;
  quantity: number;
}

export interface CreateOrderResponse {
  id: string;
  productId: string;
}
