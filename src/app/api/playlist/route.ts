import { NextResponse } from "next/server";
import { getPlaylists, licensePlaylist, BundleUse } from "@/lib/playlist";

export async function GET() {
  return NextResponse.json({ playlists: getPlaylists() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const use = (body?.use || "sync") as BundleUse;
  const id = body?.id || "pl_label_001";
  const result = licensePlaylist(id, use);
  return NextResponse.json(result);
}