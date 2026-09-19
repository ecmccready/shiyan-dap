export type ChannelId = "channel-a" | "channel-b";

export type Channel = {
  id: ChannelId;
  label: string;
  role: string;
};

export type Workspace = {
  workspace_id: string;
  label: string;
  channels: Channel[];
  enterprise_product: false;
  level3: false;
};

export const WORKSPACE: Workspace = {
  workspace_id: "ws_shiyan_founder",
  label: "Shiyan founder workspace",
  enterprise_product: false,
  level3: false,
  channels: [
    {
      id: "channel-a",
      label: "Channel A",
      role: "Agent A offers. Controlled B may close. Assets and trades live here.",
    },
    {
      id: "channel-b",
      label: "Channel B",
      role: "Counterparty context. Live B only when independent and unsettled by this page.",
    },
  ],
};