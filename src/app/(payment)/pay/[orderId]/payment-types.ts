export interface PaymentProvider {
  provider: string;
  name: string;
  channel?: string;
}

export interface PaymentInfo {
  tradeNo: string;
  paymentUrl?: string;
  qrCode?: string;
  raw?: {
    walletAddress?: string;
    usdtAmount?: string;
    cnyAmount?: string;
    exchangeRate?: number;
    network?: string;
  };
}

export interface OrderPaymentSnapshot {
  orderId: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
  paymentMethod: string | null;
  tradeNo: string | null;
  paymentUrl: string | null;
  expireAt: string | null;
  note: string | null;
}

export interface PaymentQueryResult {
  status: "pending" | "paid" | "cancelled" | "refunded" | "processing_failed";
  error?: string;
}

export type PaymentPageStatus = "booting" | "idle" | "creating" | "waiting" | "paid";
