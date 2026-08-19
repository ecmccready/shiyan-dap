"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

function CheckoutForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setError(error.message || "Payment failed");
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 h-11 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Processing…" : "Pay Now"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-5 rounded-full border border-zinc-600 text-zinc-300 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function StripePayment({
  clientSecret,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  if (!clientSecret) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Complete Payment</h3>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
        </Elements>
      </div>
    </div>
  );
}