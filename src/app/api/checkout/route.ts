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
    const cluster = body.cluster === "B" ? "B" : "A";
    const offerId = body.offerId || "OFFER-shiyan-yishu-001";

    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url:
        app +
        "/proof?session_id={CHECKOUT_SESSION_ID}&asset=" +
        assetId +
        "&cluster=" +
        cluster,
      cancel_url: app + "/offer?canceled=1&asset=" + assetId,
      metadata: {
        assetId,
        title,
        cluster,
        offerId,
        workspaceId: "WS-founder",
        channelId: cluster === "B" ? "CH-b" : "CH-a",
        from: cluster === "B" ? "potential-customer" : "ECMcCready",
        to: cluster === "B" ? "Agent B" : "Agent A",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 100,
            product_data: {
              name: title + (cluster === "B" ? " · B" : " · A"),
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
    return NextResponse.json({ error: message },