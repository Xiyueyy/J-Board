export interface PanelClientStat {
  email: string;
  up: number;
  down: number;
  enable: boolean;
}

export interface PanelInbound {
  id: number;
  protocol: string;
  port: number;
  tag: string;
  remark: string;
  listen?: string;
  settings: string;
  streamSettings: string;
  clientStats: PanelClientStat[];
}

export interface CreateClientParams {
  inboundId: number;
  email: string;
  uuid: string;
  subId?: string;
  totalGB?: number;
  expiryTime?: number;
  protocol: string;
}
