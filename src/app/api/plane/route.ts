import { planeContract } from "@/lib/capability-plane";

export async function GET() {
  return Response.json(planeContract());
}