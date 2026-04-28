import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type {
  PaymentAdapter,
  CreatePaymentParams,
  PaymentResult,
  PaymentNotification,
} from "./adapter";

export interface UsdtTrc20Config {
  walletAddress: string;
  tronApiUrl?: string;
  tronApiKey?: string;
  usdtContract?: string;
  exchangeRate: number;
}

const DEFAULT_TRON_API = "https://api.trongrid.io";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export class UsdtTrc20Adapter implements PaymentAdapter {
  readonly name = "usdt_trc20";
  private config: UsdtTrc20Config;

  constructor(config: UsdtTrc20Config) {
    this.config = {
      walletAddress: config.walletAddress,
      exchangeRate: config.exchangeRate,
      tronApiUrl: config.tronApiUrl || DEFAULT_TRON_API,
      tronApiKey: config.tronApiKey || "",
      usdtContract: config.usdtContract || USDT_TRC20_CONTRACT,
    };
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const usdtAmount = this.config.exchangeRate > 0
      ? (params.amount / this.config.exchangeRate).toFixed(2)
      : params.amount.toFixed(2);

    return {
      success: true,
      tradeNo: params.tradeNo,
      qrCode: this.config.walletAddress,
      raw: {
        walletAddress: this.config.walletAddress,
        usdtAmount,
        cnyAmount: params.amount.toFixed(2),
        exchangeRate: this.config.exchangeRate,
        network: "TRC20",
      },
    };
  }

  async verifyNotification(): Promise<PaymentNotification | null> {
    return null;
  }

  async queryOrder(tradeNo: string, createdAfter?: number): Promise<PaymentNotification | null> {
    const expectedCny = this.parseAmountFromTradeNo(tradeNo);
    if (!expectedCny) return null;

    const expectedUsdt = this.config.exchangeRate > 0
      ? expectedCny / this.config.exchangeRate
      : expectedCny;

    const transfers = await this.getRecentTransfers();

    for (const tx of transfers) {
      if (createdAfter && tx.timestamp < createdAfter) continue;

      const amount = tx.amount / 1e6;
      if (Math.abs(amount - expectedUsdt) < 0.01) {
        return {
          tradeNo,
          amount: expectedCny,
          status: "success",
          paymentRef: tx.txId,
        };
      }
    }

    return null;
  }

  private async getRecentTransfers(): Promise<Array<{ txId: string; amount: number; timestamp: number }>> {
    const url = `${this.config.tronApiUrl}/v1/accounts/${this.config.walletAddress}/transactions/trc20?limit=20&contract_address=${this.config.usdtContract}&only_to=true`;

    const headers: Record<string, string> = {};
    if (this.config.tronApiKey) {
      headers["TRON-PRO-API-KEY"] = this.config.tronApiKey;
    }

    const res = await fetchWithTimeout(url, { headers }, 15_000);
    if (!res.ok) return [];

    const json = await res.json();
    if (!json.data) return [];

    return json.data.map((tx: {
      transaction_id: string;
      value: string;
      block_timestamp: number;
    }) => ({
      txId: tx.transaction_id,
      amount: parseInt(tx.value),
      timestamp: tx.block_timestamp,
    }));
  }

  private parseAmountFromTradeNo(tradeNo: string): number | null {
    const parts = tradeNo.split("-");
    const amountStr = parts[parts.length - 1];
    const amount = parseFloat(amountStr);
    return isNaN(amount) ? null : amount;
  }
}
