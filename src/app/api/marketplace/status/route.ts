import { NextResponse } from "next/server";
import {
  updateClusterStatus,
  getClusterById,
} from "@/lib/marketplace";
import { processPayment } from "@/lib/payment";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!["available", "reserved", "settled"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    // Update status first
    updateClusterStatus(id, status);
    const updated = getClusterById(id);

    // If we just settled, trigger payment
    let paymentResult = null;
    if (status === "settled" && updated) {
      paymentResult = await processPayment(
        {
          clusterId: updated.id,
          amount: updated.artistPayout || 29.4,
          currency: "usd",
          owner: updated.owner,
          description: `Settlement for cluster: ${updated.name}`,
        },
        "simulated"
      );
    }

    return NextResponse.json({
      success: true,
      cluster: updated,
      payment: paymentResult,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to update status" },
      { status: 500 }
    );
  }
}