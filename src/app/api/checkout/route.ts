import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const TITLES: Record<string, string> = {
  cl_shiyan_yishu_001: "Shiyan Yishu — First Single",
  cl_sleep_terrors_001: "Sleep Terrors — Second Single",
};

export async function POST(req: NextRequest) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    const app = process.env.APP_URL || "https://shiyan-dap.vercel.app";
    if (!key) {
      return NextResponse.json({ error: "STRIPE_SECRET_KEY missing" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const assetId = body.assetId || "cl_shiyan_yishu_001";
    const title = body.title || TITLES[assetId] || "Shiyan catalog";

    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: app + "/nfts?paid=1&asset=" + assetId,
      cancel_url: app + "/nfts?paid=0&asset=" + assetId,
      metadata: { assetId, title, from: "ECMcCready", to: "This session" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 100,
            product_data: {
              name: title,
              tax_code: "txcd_10401200",
            },
          },
        },
      ],
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe returned no URL" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}