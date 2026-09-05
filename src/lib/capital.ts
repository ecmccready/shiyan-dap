export interface CapitalSplit {
  user: number;
  engine: number;
  tokenReserve: number;
  laterCrypto: number;
  modelAgnostic: true;
  source: "attention+token";
}

export function allocateCapital(params: {
  attention: number;
  tokenPrice?: number;
}) {
  const gross = Number((params.attention * 10).toFixed(2));
  const tokenReserve = Number(((params.tokenPrice || 1) * 0.1).toFixed(2));
  return {
    gross,
    split: {
      user: Number((gross * 0.6).toFixed(2)),
      engine: Number((gross * 0.25).toFixed(2)),
      tokenReserve,
      laterCrypto: Number((gross * 0.05).toFixed(2)),
      modelAgnostic: true as const,
      source: "attention+token" as const,
    } satisfies CapitalSplit,
    rails: {
      fiat: "playlist",
      token: "MUSIC/MVID",
      cryptoApp: "later dedicated app",
      weights: "https://huggingface.co/shiyan-dap",
    },
  };
}