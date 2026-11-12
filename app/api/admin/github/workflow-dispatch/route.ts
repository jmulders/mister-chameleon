/**
 * POST /api/admin/github/workflow-dispatch
 *
 * Triggers a GitHub Actions workflow_dispatch event for the configured repo.
 *
 * Body:
 *   workflow  — workflow filename, e.g. "staging.yml"
 *   ref       — branch/tag to run on (default: "main")
 *   inputs    — optional key/value map for workflow inputs
 *
 * Requires GITHUB_TOKEN env var with `actions:write` scope (classic PAT or
 * fine-grained token with "Actions" read+write permission).
 *
 * Auth: superadmin session. Only the workflows the admin UI offers can be
 * started, see lib/admin-auth/workflow-dispatch-input.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { guardSuperAdminRoute } from "@/lib/admin-auth/route-guard";
import { parseWorkflowDispatch } from "@/lib/admin-auth/workflow-dispatch-input";

const REPO = process.env.GITHUB_REPO ?? "jmulders/mister-chameleon";

export async function POST(req: NextRequest) {
  // Superadmin only. This route spends the server's GitHub token: it can start
  // a production deploy or a rollback.
  const guard = await guardSuperAdminRoute();
  if (!guard.ok) return guard.response;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured. Add a PAT with actions:write scope to your environment variables." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseWorkflowDispatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { workflow, ref, inputs } = parsed.value;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref, inputs }),
    },
  );

  // GitHub returns 204 No Content on success — no body.
  if (res.status === 204) {
    return NextResponse.json({ ok: true });
  }

  let message = `GitHub API responded with ${res.status}`;
  try {
    const body = await res.json();
    message = body.message ?? message;
  } catch {
    // ignore parse errors
  }

  return NextResponse.json({ error: message }, { status: res.status });
}
