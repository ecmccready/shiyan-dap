export type TokenAction = "buy" | "sell" | "trade";

export interface Token {
  id: string;
  symbol: string;
  name: string;
  domain: string;
  owner: string;
  balance: number;
  price: number; // in USD for now
  createdAt: string;
  lastUpdated: string;
}

export interface TokenTransaction {
  id: string;
  tokenId: string;
  action: TokenAction;
  from: string;
  to: string;
  amount: number;
  price: number;
  total: number;
  domain: string;
  timestamp: string;
  status: "pending" | "completed" | "failed";
}

// Simple in-memory stores
let tokens: Token[] = [];
let transactions: TokenTransaction[] = [];

/**
 * Create or update a token for a cluster / domain asset
 */
export function createToken(params: {
  symbol: string;
  name: string;
  domain: string;
  owner: string;
  initialSupply?: number;
  price?: number;
}): Token {
  const existing = tokens.find(
    (t) => t.symbol === params.symbol && t.domain === params.domain
  );

  if (existing) {
    return existing;
  }

  const token: Token = {
    id: `tok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol: params.symbol,
    name: params.name,
    domain: params.domain,
    owner: params.owner,
    balance: params.initialSupply ?? 1000,
    price: params.price ?? 1.0,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  tokens.push(token);
  return token;
}

/**
 * Execute a Buy / Sell / Trade action
 */
export function executeTokenAction(params: {
  tokenId: string;
  action: TokenAction;
  from: string;
  to: string;
  amount: number;
}): TokenTransaction | null {
  const token = tokens.find((t) => t.id === params.tokenId);
  if (!token) return null;

  const total = Number((params.amount * token.price).toFixed(2));

  // Very simple balance logic for now
  if (params.action === "sell" || params.action === "trade") {
    if (token.balance < params.amount) {
      return null; // insufficient balance
    }
    token.balance -= params.amount;
  }

  if (params.action === "buy") {
    token.balance += params.amount;
  }

  token.lastUpdated = new Date().toISOString();

  const tx: TokenTransaction = {
    id: `tx_${Date.now()}`,
    tokenId: token.id,
    action: params.action,
    from: params.from,
    to: params.to,
    amount: params.amount,
    price: token.price,
    total,
    domain: token.domain,
    timestamp: new Date().toISOString(),
    status: "completed",
  };

  transactions.push(tx);
  return tx;
}

export function getAllTokens(): Token[] {
  return [...tokens];
}

export function getTokensByDomain(domain: string): Token[] {
  return tokens.filter((t) => t.domain === domain);
}

export function getTokenTransactions(tokenId?: string): TokenTransaction[] {
  if (tokenId) {
    return transactions.filter((t) => t.tokenId === tokenId);
  }
  return [...transactions];
}