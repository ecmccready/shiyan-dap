import { NextResponse } from 'next/server';
import { listPluginTools } from '@/lib/plugin-tools';

export const dynamic = 'force-dynamic';

/** Read-only discovery of workbench plugin tools. Execution is not exposed over HTTP yet. */
export async function GET() {
  const tools = listPluginTools();
  return NextResponse.json({ ok: true, count: tools.length, tools });
}
