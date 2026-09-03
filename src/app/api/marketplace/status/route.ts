import { NextResponse } from "next/server";
import { promoteLayer } from "@/lib/economy";

async function updateWithLayer(id: string, status: string) {
  const market = await import("@/lib/marketplace");
  const layer = promoteLayer(status);

  const fn =
    (market as any).updateClusterStatus ||
    (market as any).updateStatus ||
    (market as any).setClusterStatus;

  let cluster: any = null;
  if (typeof fn === "function") {
    cluster = fn(id, status);
  }

  if (cluster) {
    cluster.containedHome = {
      ...(cluster.containedHome || {
        href: `/home?cluster=${id}`,
        owner: cluster.owner,
        clusterId: id,
      }),
      layer,
    };
    cluster.layer = layer;
  }

  return { cluster, layer, payment: cluster?.payment || null };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body || {};

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "id and status required" },
        { status: 400 }
      );
    }

    const result = await updateWithLayer(id, status);

    return NextResponse.json({
      success: true,
      cluster: result.cluster,
      layer: result.layer,
      payment: result.payment,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Status update failed" },
      { status: 500 }
    );
  }
}