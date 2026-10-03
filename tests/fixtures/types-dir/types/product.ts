export interface CreateProductRequest {
  name: string;
  price: number;
}

export interface CreateProductResponse {
  id: string;
  name: string;
  price: number;
}
