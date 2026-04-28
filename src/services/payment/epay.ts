import crypto from "crypto";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type {
  PaymentAdapter,
  CreatePaymentParams,
  PaymentResult,
  PaymentNotification,
} from "./adapter";

export interface EasyPayConfig {
  apiUrl: string;
  pid: string;
  key: string;
}

export class EasyPayAdapter implements PaymentAdapter {
  readonly name = "epay";
  private config: EasyPayConfig;

  constructor(config: EasyPayConfig) {
    this.config = config;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const type = params.channel === "wxpay" ? "wxpay" : "alipay";

    const data: Record<string, string> = {
      pid: this.config.pid,
      type,
      out_trade_no: params.tradeNo,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      name: params.subject,
      money: params.amount.toFixed(2),
    };

    data.sign = this.sign(data);
    data.sign_type = "MD5";

    // Try mapi.php first (returns JSON with payment URL), fall back to submit.php
    try {
      const qs = new URLSearchParams(data).toString();
      const res = await fetchWithTimeout(
        `${this.config.apiUrl}/mapi.php?${qs}`,
        undefined,
        15_000,
      );

      if (res.ok) {
        const json = await res.json() as Record<string, unknown>;
        if (json.code === 1 || json.code === "1") {
          const paymentUrl =
            (json.payurl as string) ||
            (json.pay_url as string) ||
            (json.qrcode as string) ||
            (json.urlscheme as string) ||
            "";
          if (paymentUrl) {
            return { success: true, paymentUrl, tradeNo: params.tradeNo };
          }
        }
      }
    } catch {
      // mapi.php not available, fall back to submit.php redirect
    }

    // Fallback: direct redirect URL via submit.php
    const qs = new URLSearchParams(data).toString();
    const paymentUrl = `${this.config.apiUrl}/submit.php?${qs}`;
    return { success: true, paymentUrl, tradeNo: params.tradeNo };
  }

  async verifyNotification(
    body: Record<string, string>
  ): Promise<PaymentNotification | null> {
    const { sign, sign_type, ...rest } = body;
    void sign_type;
    const expected = this.sign(rest);
    if (sign !== expected) return null;

    if (body.trade_status !== "TRADE_SUCCESS") return null;

    return {
      tradeNo: body.out_trade_no,
      amount: parseFloat(body.money),
      status: "success",
      paymentRef: body.trade_no,
    };
  }

  async queryOrder(tradeNo: string): Promise<PaymentNotification | null> {
    const data: Record<string, string> = {
      act: "order",
      pid: this.config.pid,
      out_trade_no: tradeNo,
    };
    data.sign = this.sign(data);
    data.sign_type = "MD5";

    const qs = new URLSearchParams(data).toString();

    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${this.config.apiUrl}/api.php?${qs}`,
        undefined,
        15_000,
      );
    } catch {
      // Network error — treat as unavailable, rely on callback notification
      return null;
    }

    if (!res.ok) {
      // Many epay platforms don't expose api.php — silently return null
      // so the polling loop keeps waiting for the async notification instead
      return null;
    }

    const json = await res.json();

    if (json.code !== 1 || json.status !== 1) return null;

    return {
      tradeNo: json.out_trade_no,
      amount: parseFloat(json.money),
      status: "success",
      paymentRef: json.trade_no,
    };
  }

  private sign(params: Record<string, string>): string {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== "" && k !== "sign" && k !== "sign_type")
      .sort();
    const str = sorted.map((k) => `${k}=${params[k]}`).join("&");
    return crypto.createHash("md5").update(str + this.config.key).digest("hex");
  }
}
