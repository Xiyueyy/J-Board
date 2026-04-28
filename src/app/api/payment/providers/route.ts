import { jsonError, jsonOk } from "@/lib/api-response";
import { getEnabledProviders } from "@/services/payment/factory";

export async function GET() {
  try {
    const providers = await getEnabledProviders();
    return jsonOk(providers);
  } catch (error) {
    return jsonError(error, { fallback: "获取支付方式失败" });
  }
}
