import { NextResponse } from "next/server";
import { getPlaylists, licensePlaylist, BundleUse } from "@/lib/playlist";

const USES: BundleUse[] = ["sync", "game", "label", "transmedia"];

function isBundleUse(value: unknown): value is BundleUse {
  return typeof value === "string" && USES.includes(value as BundleUse);
}

export async function GET() {
  return NextResponse.json({ playlists: getPlaylists() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const requestedUse = "use" in body ? body.use : undefined;
  const requestedId = "id" in body ? body.id : undefined;
  if (
    (requestedUse !== undefined &&
      !isBundleUse(requestedUse)) ||
    (requestedId !== undefined && typeof requestedId !== "string")
  ) {
    return NextResponse.json(
      { success: false, error: "use or id is invalid" },
      { status: 400 }
    );
  }

  const use = requestedUse || "sync";
  const id = typeof requestedId === "string" ? requestedId || "pl_label_001" : "pl_label_001";
  const result = licensePlaylist(id, use);
  if (!result) {
    return NextResponse.json(
      { success: false, error: "Playlist not found" },
      { status: 404 }
    );
  }
  return NextResponse.json(result);
}
