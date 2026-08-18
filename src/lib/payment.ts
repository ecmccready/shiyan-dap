export type PaymentProvider = "simulated" | "stripe" | "crypto";

export interface PaymentRequest {
  clusterId: string;
  amount: number; // in USD
  currency?: string;
  owner: string;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  provider: PaymentProvider;
  transactionId?: string;
  amount: number;
  message: string;
  raw?: any;
}

/**
 * Payment Adapter
 * Currently supports simulated payments.
 * Stripe (and later crypto) can be plugged in without changing the rest of the system.
 */
export async function processPayment(
  request: PaymentRequest,
  provider: PaymentProvider = "simulated"
): Promise<PaymentResult> {
  // ----- SIMULATED (always available) -----
  if (provider === "simulated") {
    return {
      success: true,
      provider: "simulated",
      transactionId: `sim_${Date.now()}`,
      amount: request.amount,
      message: `Simulated payment of $${request.amount} to ${request.owner} succeeded`,
    };
  }

  // ----- STRIPE (ready for real keys) -----
  if (provider === "stripe") {
    // Future: real Stripe integration will go here
    // For now we safely fall back so the system never breaks
    console.warn("Stripe provider selected but not yet fully configured – falling back to simulated");
    
    return {
      success: true,
      provider: "simulated",
      transactionId: `sim_stripe_fallback_${Date.now()}`,
      amount: request.amount,
      message: `Stripe not fully configured – used simulated payment of $${request.amount}`,
    };
  }

  // ----- CRYPTO (future) -----
  if (provider === "crypto") {
    return {
      success: false,
      provider: "crypto",
      amount: request.amount,
      message: "Crypto payments not yet implemented",
    };
  }

  return {
    success: false,
    provider: "simulated",
    amount: request.amount,
    message: "Unknown payment provider",
  };
}