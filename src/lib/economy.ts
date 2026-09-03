export interface AdPayout {
  userShare: number;
  engineShare: number;
  userPayout: number;
  enginePayout: number;
  currency: "USD";
  rail: "playlist";
  later: "crypto";
}

export interface ContainedHome {
  href: string;
  owner: string;
  clusterId: string;
  layer: "C2C" | "B2C" | "B2B";
}

/**
 * Ads pay both the creator and the protocol.
 * Fiat is the root. Crypto is the later dedicated-app rail.
 */
export function splitAdValue(attention: number): AdPayout {
  const gross = Number((attention * 10).toFixed(2));
  const userShare = 0.7;
  const engineShare = 0.3;
  return {
    userShare,
    engineShare,
    userPayout: Number((gross * userShare).toFixed(2)),
    enginePayout: Number((gross * engineShare).toFixed(2)),
    currency: "USD",
    rail: "playlist",
    later: "crypto",
  };
}

export function containHomePage(params: {
  clusterId: string;
  owner: string;
}): ContainedHome {
  return {
    href: `/home?cluster=${params.clusterId}`,
    owner: params.owner,
    clusterId: params.clusterId,
    layer: "C2C",
  };
}