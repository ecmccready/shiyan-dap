import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST() {
  const key = process.env.STRIPE_SECRET_KEY;
  const app = process.env.APP_URL || "https://shiyan-dap.vercel.app";

  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY missing" }, { status: 500 });
  }

  const stripe = new Stripe(key);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: app + "/nfts?paid=1",
    cancel_url: app + "/nfts?paid=0",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 100,
          product_data: { name: "Shiyan Yishu — First Single" },
        },
      },
    ],
  });

  return NextResponse.json({ url: session.url });
}