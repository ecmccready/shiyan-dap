import Stripe from "stripe";

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
  clientSecret?: string; // used by Stripe Checkout / PaymentIntent
  raw?: any;
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    })
  : null;

/**
 * Payment Adapter – supports simulated + Stripe
 * Crypto path is reserved for later.
 */
export async function processPayment(
  request: PaymentRequest,
  provider: PaymentProvider = "simulated"
): Promise<PaymentResult> {
  // ----- SIMULATED -----
  if (provider === "simulated") {
    return {
      success: true,
      provider: "simulated",
      transactionId: `sim_${Date.now()}`,
      amount: request.amount,
      message: `Simulated payment of $${request.amount} to ${request.owner} succeeded`,
    };
  }

  // ----- STRIPE -----
  if (provider === "stripe") {
    if (!stripe) {
      return {
        success: false,
        provider: "stripe",
        amount: request.amount,
        message: "Stripe is not configured (missing STRIPE_SECRET_KEY)",
      };
    }

    try {
      // Create a PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // Stripe uses cents
        currency: request.currency || "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          clusterId: request.clusterId,
          owner: request.owner,
        },
        description: request.description,
      });

      return {
        success: true,
        provider: "stripe",
        transactionId: paymentIntent.id,
        amount: request.amount,
        clientSecret: paymentIntent.client_secret || undefined,
        message: "Stripe PaymentIntent created successfully",
        raw: paymentIntent,
      };
    } catch (error: any) {
      console.error("Stripe error:", error);
      return {
        success: false,
        provider: "stripe",
        amount: request.amount,
        message: error.message || "Stripe payment failed",
      };
    }
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