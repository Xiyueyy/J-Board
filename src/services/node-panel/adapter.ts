import type { CreateClientParams, PanelClientStat, PanelInbound } from "./types";

export interface NodePanelAdapter {
  login(): Promise<boolean>;
  getInbounds(): Promise<PanelInbound[]>;
  addClient(params: CreateClientParams): Promise<void>;
  deleteClient(inboundId: number, clientCredential: string): Promise<void>;
  updateClientEnable(inboundId: number, clientCredential: string, enable: boolean): Promise<void>;
  updateClient(params: CreateClientParams & { enable?: boolean }): Promise<void>;
  getClientTraffic(email: string): Promise<PanelClientStat | null>;
  getAllClientTraffics(inboundId: number): Promise<PanelClientStat[]>;
  resetClientTraffic(inboundId: number, email: string): Promise<void>;
}
