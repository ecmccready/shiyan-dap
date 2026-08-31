import { NextResponse } from "next/server";
import { getPlaylists } from "@/lib/playlist";

export async function GET() {
  return NextResponse.json({
    success: true,
    playlists: getPlaylists(),
  });
}