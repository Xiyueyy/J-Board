import crypto from "crypto";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type {
  PaymentAdapter,
  CreatePaymentParams,
  PaymentResult,
  PaymentNotification,
} from "./adapter";

function wrapPem(key: string, label: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("-----")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export interface AlipayF2FConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
}

export class AlipayF2FAdapter implements PaymentAdapter {
  readonly name = "alipay_f2f";
  private config: AlipayF2FConfig;
  private pemPrivateKey: string;
  private pemPublicKey: string;

  constructor(config: AlipayF2FConfig) {
    this.config = config;
    this.pemPrivateKey = wrapPem(config.privateKey, "RSA PRIVATE KEY");
    this.pemPublicKey = wrapPem(config.alipayPublicKey, "PUBLIC KEY");
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const bizContent = JSON.stringify({
      out_trade_no: params.tradeNo,
      total_amount: params.amount.toFixed(2),
      subject: params.subject,
    });

    const commonParams: Record<string, string> = {
      app_id: this.config.appId,
      method: "alipay.trade.precreate",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      version: "1.0",
      notify_url: params.notifyUrl,
      biz_content: bizContent,
    };

    commonParams.sign = this.rsaSign(commonParams);

    const res = await fetchWithTimeout(
      this.config.gateway,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(commonParams).toString(),
      },
      15_000,
    );
    if (!res.ok) {
      throw new Error(`支付宝当面付下单失败 (HTTP ${res.status})`);
    }

    const json = await res.json();
    const response = json.alipay_trade_precreate_response;

    if (response?.code !== "10000") {
      return { success: false, tradeNo: params.tradeNo, raw: json };
    }

    return {
      success: true,
      qrCode: response.qr_code,
      tradeNo: params.tradeNo,
      raw: json,
    };
  }

  async verifyNotification(
    body: Record<string, string>
  ): Promise<PaymentNotification | null> {
    const { sign, sign_type, ...rest } = body;
    void sign_type;
    if (!this.rsaVerify(rest, sign)) return null;

    if (body.trade_status !== "TRADE_SUCCESS") return null;

    return {
      tradeNo: body.out_trade_no,
      amount: parseFloat(body.total_amount),
      status: "success",
      paymentRef: body.trade_no,
    };
  }

  async queryOrder(tradeNo: string): Promise<PaymentNotification | null> {
    const bizContent = JSON.stringify({ out_trade_no: tradeNo });
    const commonParams: Record<string, string> = {
      app_id: this.config.appId,
      method: "alipay.trade.query",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      version: "1.0",
      biz_content: bizContent,
    };
    commonParams.sign = this.rsaSign(commonParams);

    const res = await fetchWithTimeout(
      this.config.gateway,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(commonParams).toString(),
      },
      15_000,
    );
    if (!res.ok) {
      throw new Error(`支付宝当面付查询失败 (HTTP ${res.status})`);
    }

    const json = await res.json();
    const response = json.alipay_trade_query_response;

    if (response?.code !== "10000") return null;
    if (response.trade_status !== "TRADE_SUCCESS") return null;

    return {
      tradeNo: response.out_trade_no,
      amount: parseFloat(response.total_amount),
      status: "success",
      paymentRef: response.trade_no,
    };
  }

  private rsaSign(params: Record<string, string>): string {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== "" && k !== "sign")
      .sort();
    const str = sorted.map((k) => `${k}=${params[k]}`).join("&");
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(str);
    return signer.sign(this.pemPrivateKey, "base64");
  }

  private rsaVerify(params: Record<string, string>, sign: string): boolean {
    const sorted = Object.keys(params)
      .filter((k) => params[k] !== "" && k !== "sign" && k !== "sign_type")
      .sort();
    const str = sorted.map((k) => `${k}=${params[k]}`).join("&");
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(str);
    return verifier.verify(this.pemPublicKey, sign, "base64");
  }
}
