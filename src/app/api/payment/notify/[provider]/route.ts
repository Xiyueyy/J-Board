import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getPaymentAdapter } from "@/services/payment/factory";
import { handleVerifiedPaymentSuccess } from "@/services/payment/process";

async function handleNotify(
  req: Request,
  provider: string,
) {
  try {
    const adapter = await getPaymentAdapter(provider);

    let body: Record<string, string>;

    // GET: query params (epay platforms often callback via GET)
    // POST: form-encoded or JSON body
    if (req.method === "GET") {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams);
    } else {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        body = await req.json();
      } else {
        const text = await req.text();
        body = Object.fromEntries(new URLSearchParams(text));
      }
    }

    const notification = await adapter.verifyNotification(body);
    if (!notification || notification.status !== "success") {
      return new Response("fail", { status: 200 });
    }

    const result = await handleVerifiedPaymentSuccess(
      notification.tradeNo,
      notification.amount,
      notification.paymentRef,
    );
    if (result.errorMessage) {
      console.error(`Payment notify provisioning failed [${provider}]:`, result.errorMessage);
      return new Response("fail", { status: 500 });
    }

    return new Response("success", { status: 200 });
  } catch (e) {
    console.error(`Payment notify error [${provider}]:`, e);
    return NextResponse.json(
      { error: getErrorMessage(e, "Internal error") },
      { status: 500 },
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  return handleNotify(req, provider);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  return handleNotify(req, provider);
}
