import { NextResponse } from "next/server";
import { githubConnectionStatus } from "@/core/github-reference";
import { isTenantAuthConfigured } from "@/core/tenant-auth";

export const dynamic = "force-dynamic";

/** Public status only: booleans and counts, never repo names, tenants or credentials. */
export async function GET() {
  const gh = githubConnectionStatus();
  return NextResponse.json({ github_configured: gh.configured, allowlisted_repos: gh.allowlisted_repos,
    tenant_auth_configured: isTenantAuthConfigured(), references: "POST/GET /api/v1/references (tenant API key required)" });
}
