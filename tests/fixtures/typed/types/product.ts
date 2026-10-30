export type ProductStatus = 'draft' | 'live';

export type OrderStatus = 'open' | 'shipped';

export interface ProductInput {
  name: string;
  price: number;
  status: ProductStatus;
}

export interface Product extends ProductInput {
  id: string;
  createdAt: Date;
}

export type ProductPatch = {
  name?: string;
  price?: number;
};
