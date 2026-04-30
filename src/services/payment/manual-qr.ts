import type {
  CreatePaymentParams,
  PaymentAdapter,
  PaymentNotification,
  PaymentResult,
} from "./adapter";

export interface ManualQrConfig {
  displayName?: string;
  qrCodeImage: string;
  instructions?: string;
  barkUrl?: string;
}

export class ManualQrAdapter implements PaymentAdapter {
  readonly name = "manual_qr";

  constructor(private config: ManualQrConfig) {}

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    return {
      success: true,
      tradeNo: params.tradeNo,
      raw: {
        qrCodeImage: this.config.qrCodeImage,
        instructions: this.config.instructions || "请扫码完成付款，付款后点击“我已付款”。管理员确认到账后会为你开通。",
        cnyAmount: params.amount.toFixed(2),
        subject: params.subject,
      },
    };
  }

  async verifyNotification(): Promise<PaymentNotification | null> {
    return null;
  }

  async queryOrder(): Promise<PaymentNotification | null> {
    return null;
  }
}
