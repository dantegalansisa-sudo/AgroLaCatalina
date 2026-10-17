export type Role = "admin" | "cajero";
export type PaymentMethod = "efectivo" | "transferencia" | "fiado";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  name: string;
  short_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  rnc: string | null;
  logo_url: string | null;
  receipt_message: string | null;
  allow_negative_stock: boolean;
  expiry_alert_days: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  presentation: string | null;
  category_id: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  min_stock: number;
  expiry_date: string | null;
  active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  cost?: number | null; // solo admin (product_costs)
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  balance: number;
  active: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface CashSession {
  id: string;
  user_id: string;
  opened_at: string;
  opening_amount: number;
  closed_at: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  summary: CashSummary | null;
  notes: string | null;
}

export interface CashSummary {
  opening_amount: number;
  sales_count: number;
  sales_total: number;
  voided_count: number;
  cash_sales: number;
  transfer_sales: number;
  credit_sales: number;
  cash_payments: number;
  transfer_payments: number;
  expected_cash: number;
}

export interface Sale {
  id: string;
  number: number;
  created_at: string;
  user_id: string;
  customer_id: string | null;
  cash_session_id: string | null;
  subtotal: number;
  line_discount: number;
  global_discount: number;
  total: number;
  cash_received: number;
  change_amount: number;
  credit_amount: number;
  note: string | null;
  status: "completada" | "anulada";
  voided_at: string | null;
  void_reason: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  presentation: string | null;
  category_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
}

export interface SaleFull extends Sale {
  sale_items: SaleItem[];
  sale_payments: SalePayment[];
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
  seller: Pick<Profile, "id" | "full_name"> | null;
}

export interface Movement {
  id: string;
  product_id: string;
  type: "inicial" | "entrada" | "ajuste" | "venta" | "anulacion";
  quantity: number;
  stock_after: number;
  unit_cost: number | null;
  supplier: string | null;
  reason: string | null;
  sale_id: string | null;
  user_id: string | null;
  created_at: string;
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  fiado: "Fiado",
};
