"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NodeDetail } from "../node-detail-data";
import { InboundsTab } from "./tabs/inbounds-tab";

export function NodeDetailTabs({ node }: { node: NodeDetail }) {
  return (
    <Tabs defaultValue="inbounds">
      <TabsList variant="line" className="w-full overflow-x-auto">
        <TabsTrigger value="inbounds">
          3x-ui 入站 ({node.inbounds.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inbounds">
        <InboundsTab node={node} />
      </TabsContent>
    </Tabs>
  );
}
