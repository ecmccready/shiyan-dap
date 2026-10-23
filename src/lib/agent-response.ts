export type AgentPyramidLevel = {
  level: string;
  description: string;
  content: Record<string, unknown>;
};

export type AgentResponse = {
  domain: string;
  title: string;
  artist: string;
  pyramid: Record<string, AgentPyramidLevel>;
  cluster: {
    name: string;
    size: number;
    tags: string[];
  };
  policyExtension: {
    policy_name: string;
    similarity_score: number;
    status?: string;
    action: string;
  };
  pi_inv: number;
  ell: number;
  model?: {
    provider?: string;
  };
  settlement?: {
    status: string;
    artist_share: number | string;
    mock_revenue: number | string;
    artist_payout: number | string;
  };
  lyrics?: {
    verse1: string;
    chorus: string;
    verse2: string;
    verse3?: string;
  };
};
