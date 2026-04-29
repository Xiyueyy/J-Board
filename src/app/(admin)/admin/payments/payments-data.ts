import { prisma } from "@/lib/prisma";
import {
  getPaymentSecretConfiguredState,
  PAYMENT_PROVIDER_DEFINITIONS,
  redactPaymentConfigForClient,
} from "@/services/payment/catalog";

export async function getPaymentProviderConfigs() {
  const configs = await prisma.paymentConfig.findMany();
  const configMap = new Map(configs.map((config) => [config.provider, config]));

  return PAYMENT_PROVIDER_DEFINITIONS.map((provider) => {
    const config = configMap.get(provider.id);
    const configValue = config?.config as Record<string, unknown> | undefined;

    return {
      provider,
      config: config
        ? {
            enabled: config.enabled,
            config: redactPaymentConfigForClient(provider.id, configValue ?? {}),
          }
        : null,
      secretConfigured: configValue
        ? getPaymentSecretConfiguredState(provider.id, configValue)
        : {},
    };
  });
}
