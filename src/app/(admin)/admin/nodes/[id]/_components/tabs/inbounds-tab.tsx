"use client";

import { Waypoints } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/page-shell";
import { InboundDeleteButton } from "../../../inbound-delete-button";
import { InboundDisplayNameForm } from "../../../inbound-display-name-form";
import type { NodeDetail } from "../../node-detail-data";

function getDisplayName(inbound: { tag: string; settings: unknown }) {
  const settings = inbound.settings;
  if (settings && typeof settings === "object" && "displayName" in settings) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return inbound.tag;
}

export function InboundsTab({ node }: { node: NodeDetail }) {
  if (node.inbounds.length === 0) {
    return (
      <EmptyState
        title="暂无已同步入站"
        description="请先在 3x-ui 面板创建入站，然后回到节点列表点击测试并同步入站。"
      />
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        入站配置由 3x-ui 面板维护；本页仅展示已同步的线路，并允许调整前台展示名称。
      </p>
      <div className="grid gap-3">
        {node.inbounds.map((inbound) => (
          <Card key={inbound.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Waypoints className="size-4 shrink-0 text-primary" />
                <CardTitle className="text-sm">
                  <InboundDisplayNameForm
                    inboundId={inbound.id}
                    defaultValue={getDisplayName(inbound)}
                  />
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{inbound.protocol}</Badge>
                <Badge variant="outline">:{inbound.port}</Badge>
                <InboundDeleteButton inboundId={inbound.id} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>客户端: {inbound.clients.length}</span>
                {inbound.streamSettings && typeof inbound.streamSettings === "object" && (
                  <>
                    {(inbound.streamSettings as Record<string, unknown>).network && (
                      <span>传输: {String((inbound.streamSettings as Record<string, unknown>).network)}</span>
                    )}
                    {(inbound.streamSettings as Record<string, unknown>).security && (
                      <span>安全: {String((inbound.streamSettings as Record<string, unknown>).security)}</span>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
