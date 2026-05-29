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
 */

import { NextRequest, NextResponse } from "next/server";

const REPO = process.env.GITHUB_REPO ?? "jmulders/mister-chameleon";

export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured. Add a PAT with actions:write scope to your environment variables." },
      { status: 500 },
    );
  }

  const { workflow, ref = "main", inputs = {} } = await req.json();
  if (!workflow) {
    return NextResponse.json({ error: "workflow is required" }, { status: 400 });
  }

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
