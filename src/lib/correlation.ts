export type CommercialIds = {
  offerId: string;
  transactionId: string;
  externalEventId: string;
  workspaceId: string;
  channelId: string;
};

export const FOUNDER_WORKSPACE = "ws_shiyan_founder";

export function offerId() {
  return "OFR-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

export function transactionId() {
  return "TXN-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

export function externalEventId() {
  return "EVT-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function ids(partial: Partial<CommercialIds> = {}): CommercialIds {
  return {
    offerId: partial.offerId || offerId(),
    transactionId: partial.transactionId || transactionId(),
    externalEventId: partial.externalEventId || externalEventId(),
    workspaceId: partial.workspaceId || FOUNDER_WORKSPACE,
    channelId: partial.channelId || "channel-b",
  };
}