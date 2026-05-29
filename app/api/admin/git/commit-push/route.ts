/**
 * POST /api/admin/git/commit-push
 *
 * Only available in development (NODE_ENV !== "production").
 * Runs: git add -A → git commit -m "{message}" → git push origin main
 *
 * Body: { message: string }
 * Returns: { ok: true, output: string } | { error: string, output?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { exec }                      from "child_process";
import { promisify }                 from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Git commit-push is only available in development mode." },
      { status: 403 },
    );
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Commit message is required." }, { status: 400 });
  }

  const cwd = process.cwd();
  const lines: string[] = [];

  try {
    // 1. Check for anything to commit
    const { stdout: statusOut } = await execAsync("git status --short", { cwd });
    if (!statusOut.trim()) {
      return NextResponse.json({ error: "Niets te committen — working tree is clean." }, { status: 400 });
    }
    lines.push(`Status:\n${statusOut.trim()}`);

    // 2. Stage all changes
    const { stdout: addOut } = await execAsync("git add -A", { cwd });
    if (addOut.trim()) lines.push(`Add:\n${addOut.trim()}`);

    // 3. Commit
    const safeMsg = message.trim().replace(/"/g, '\\"');
    const { stdout: commitOut } = await execAsync(
      `git commit -m "${safeMsg}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`,
      { cwd },
    );
    lines.push(`Commit:\n${commitOut.trim()}`);

    // 4. Push
    const { stdout: pushOut, stderr: pushErr } = await execAsync(
      "git push origin main",
      { cwd },
    );
    lines.push(`Push:\n${(pushOut + pushErr).trim()}`);

    return NextResponse.json({ ok: true, output: lines.join("\n\n") });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
    return NextResponse.json(
      { error: e.message ?? "Git command failed", output },
      { status: 500 },
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ available: false });
  }

  try {
    const { stdout } = await execAsync("git status --short", { cwd: process.cwd() });
    const files = stdout.trim().split("\n").filter(Boolean);
    return NextResponse.json({ available: true, changedFiles: files });
  } catch {
    return NextResponse.json({ available: false });
  }
}
