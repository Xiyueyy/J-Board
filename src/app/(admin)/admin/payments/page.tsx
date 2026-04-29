import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ActiveStatusBadge } from "@/components/shared/status-badge";
import { PaymentConfigForm } from "./config-form";
import { getPaymentProviderConfigs } from "./payments-data";

export const metadata: Metadata = {
  title: "支付配置",
  description: "配置支付渠道、密钥与启用状态。",
};

export default async function PaymentsPage() {
  const providerConfigs = await getPaymentProviderConfigs();

  return (
    <PageShell>
      <PageHeader
        eyebrow="系统"
        title="支付配置"
      />
      <div className="grid gap-5">
        {providerConfigs.map(({ provider, config, secretConfigured }) => (
          <section key={provider.id} className="surface-card overflow-hidden rounded-xl p-4">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CreditCard className="size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{provider.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">{provider.description}</p>
                </div>
              </div>
              <ActiveStatusBadge active={config?.enabled ?? false} activeLabel="已启用" inactiveLabel="未启用" />
            </div>
            <PaymentConfigForm
              provider={provider.id}
              fields={provider.fields}
              currentConfig={config?.config}
              secretConfigured={secretConfigured}
              enabled={config?.enabled ?? false}
            />
          </section>
        ))}
      </div>
    </PageShell>
  );
}
