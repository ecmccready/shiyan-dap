import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const TITLES: Record<string, string> = {
  cl_shiyan_yishu_001: "Shiyan Yishu — First Single",
  cl_sleep_terrors_001: "Sleep Terrors — Second Single",
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;
  const assetId = payload.assetId ?? "cl_shiyan_yishu_001";
  const cluster = payload.cluster ?? "A";
  const offerId = payload.offerId ?? "OFFER-shiyan-yishu-001";
  const title =
    payload.title ??
    (typeof assetId === "string" ? TITLES[assetId] : undefined) ??
    "Shiyan catalog";
  if (
    typeof assetId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(assetId) ||
    (cluster !== "A" && cluster !== "B") ||
    typeof offerId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(offerId) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 200
  ) {
    return NextResponse.json(
      { error: "Invalid assetId, cluster, offerId, or title" },
      { status: 400 }
    );
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY missing" }, { status: 500 });
  }

  const app = process.env.APP_URL || "https://shiyan-dap.vercel.app";
  let appUrl: URL;
  try {
    appUrl = new URL(app);
  } catch {
    console.error("Invalid APP_URL configuration");
    return NextResponse.json({ error: "Checkout configuration is invalid" }, { status: 500 });
  }
  if (
    (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") ||
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash
  ) {
    console.error("Invalid APP_URL configuration");
    return NextResponse.json({ error: "Checkout configuration is invalid" }, { status: 500 });
  }

  const baseUrl = appUrl.toString().replace(/\/$/, "");
  const clusterChannel = cluster === "B" ? "CH-b" : "CH-a";
  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url:
        `${baseUrl}/proof?session_id={CHECKOUT_SESSION_ID}` +
        `&asset=${encodeURIComponent(assetId)}&cluster=${cluster}`,
      cancel_url: `${baseUrl}/offer?canceled=1&asset=${encodeURIComponent(assetId)}`,
      metadata: {
        assetId,
        title,
        cluster,
        offerId,
        workspaceId: "WS-founder",
        channelId: clusterChannel,
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
      console.error("Stripe returned a checkout session without a URL");
      return NextResponse.json({ error: "Stripe returned no URL" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe checkout session creation failed:", error);
    return NextResponse.json({ error: "Checkout session creation failed" }, { status: 502 });
  }
}