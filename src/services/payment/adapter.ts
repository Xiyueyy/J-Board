export interface CreatePaymentParams {
  tradeNo: string;
  amount: number;
  subject: string;
  notifyUrl: string;
  returnUrl: string;
  channel?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  qrCode?: string;
  tradeNo: string;
  raw?: unknown;
}

export interface PaymentNotification {
  tradeNo: string;
  amount: number;
  status: "success" | "failed";
  paymentRef?: string;
  raw?: unknown;
}

export interface PaymentAdapter {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  verifyNotification(body: Record<string, string>, headers?: Record<string, string>): Promise<PaymentNotification | null>;
  queryOrder(tradeNo: string, createdAfter?: number): Promise<PaymentNotification | null>;
}
