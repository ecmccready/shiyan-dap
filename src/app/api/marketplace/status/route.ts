import { NextResponse } from "next/server";
import { updateClusterStatus, getClusterById } from "@/lib/marketplace";

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

    updateClusterStatus(id, status);
    const updated = getClusterById(id);

    return NextResponse.json({
      success: true,
      cluster: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update status" },
      { status: 500 }
    );
  }
}