import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER_DEFINITIONS } from "@/services/payment/catalog";

export async function getPaymentProviderConfigs() {
  const configs = await prisma.paymentConfig.findMany();
  const configMap = new Map(configs.map((config) => [config.provider, config]));

  return PAYMENT_PROVIDER_DEFINITIONS.map((provider) => ({
    provider,
    config: configMap.get(provider.id),
  }));
}
