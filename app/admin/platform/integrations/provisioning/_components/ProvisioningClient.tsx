"use client";

/**
 * ProvisioningClient — GitHub + Ploi Cloud credential panels.
 * Secret-safe: token inputs are write-only; presence shown via a "saved" badge.
 */

import { useState, useTransition, type ReactNode } from "react";
import {
  saveGithubSettingsAction, savePloiSettingsAction,
  testGithubConnectionAction, testPloiConnectionAction,
} from "../actions";

type GithubFlags = {
  hasToken: boolean; templateOwner: string; templateRepo: string;
  repoOwner: string; privateRepos: boolean; isConfigured: boolean; updatedAt: string | null;
};
type PloiFlags = {
  hasToken: boolean; team: string; phpVersion: string;
  platformApiUrl: string; isConfigured: boolean; updatedAt: string | null;
};

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

function Status({ msg }: { msg: { kind: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-xs ${msg.kind === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>
  );
}

export function ProvisioningClient({ github, ploi }: { github: GithubFlags; ploi: PloiFlags }) {
  // GitHub
  const [ghToken, setGhToken]   = useState("");
  const [ghTplOwner, setGhTplOwner] = useState(github.templateOwner);
  const [ghTplRepo, setGhTplRepo]   = useState(github.templateRepo);
  const [ghRepoOwner, setGhRepoOwner] = useState(github.repoOwner);
  const [ghPrivate, setGhPrivate]   = useState(github.privateRepos);
  const [ghMsg, setGhMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [ghPending, ghStart] = useTransition();

  // Ploi
  const [ploiToken, setPloiToken] = useState("");
  const [ploiTeam, setPloiTeam]   = useState(ploi.team);
  const [ploiPhp, setPloiPhp]     = useState(ploi.phpVersion);
  const [ploiUrl, setPloiUrl]     = useState(ploi.platformApiUrl);
  const [ploiMsg, setPloiMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [ploiPending, ploiStart] = useTransition();

  return (
    <div className="space-y-6">

      {/* GitHub */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">GitHub</h2>
          <span className={`rounded px-2 py-0.5 text-[11px] ${github.hasToken ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {github.hasToken ? "token configured" : "no token"}
          </span>
        </div>
        <div className="space-y-3">
          <Field label="Personal Access Token" hint="classic 'repo' scope, or fine-grained with Administration + Contents read/write. Leave blank to keep the stored token. Falls back to env GITHUB_TOKEN.">
            <input type="password" className={inputCls} value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder={github.hasToken ? "•••••• saved: paste to replace" : "ghp_…"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Template owner"><input className={inputCls} value={ghTplOwner} onChange={(e) => setGhTplOwner(e.target.value)} /></Field>
            <Field label="Template repo"><input className={inputCls} value={ghTplRepo} onChange={(e) => setGhTplRepo(e.target.value)} /></Field>
          </div>
          <Field label="New-repo owner" hint="user/org the per-tenant repos are created under"><input className={inputCls} value={ghRepoOwner} onChange={(e) => setGhRepoOwner(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-xs text-neutral-700">
            <input type="checkbox" checked={ghPrivate} onChange={(e) => setGhPrivate(e.target.checked)} />
            Create generated repos as private
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={ghPending}
              onClick={() => ghStart(async () => {
                const r = await saveGithubSettingsAction({
                  token: ghToken || undefined, templateOwner: ghTplOwner, templateRepo: ghTplRepo,
                  repoOwner: ghRepoOwner, privateRepos: ghPrivate,
                });
                setGhMsg(r.ok ? { kind: "ok", text: "Saved." } : { kind: "err", text: r.error });
                if (r.ok) setGhToken("");
              })}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {ghPending ? "Saving…" : "Save GitHub"}
            </button>
            <button
              type="button"
              disabled={ghPending}
              onClick={() => ghStart(async () => {
                const r = await testGithubConnectionAction();
                setGhMsg(r.ok ? { kind: "ok", text: r.message } : { kind: "err", text: r.error });
              })}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700"
            >
              Test
            </button>
            <Status msg={ghMsg} />
          </div>
        </div>
      </section>

      {/* Ploi Cloud */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Ploi Cloud</h2>
          <span className={`rounded px-2 py-0.5 text-[11px] ${ploi.hasToken ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {ploi.hasToken ? "token configured" : "no token"}
          </span>
        </div>
        <div className="space-y-3">
          <Field label="API token" hint="ploi.cloud dashboard → API tokens. Leave blank to keep the stored token. Falls back to env PLOI_CLOUD_TOKEN.">
            <input type="password" className={inputCls} value={ploiToken} onChange={(e) => setPloiToken(e.target.value)} placeholder={ploi.hasToken ? "•••••• saved: paste to replace" : "ploi_…"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Team (id or name)"><input className={inputCls} value={ploiTeam} onChange={(e) => setPloiTeam(e.target.value)} placeholder="e.g. 1" /></Field>
            <Field label="PHP version"><input className={inputCls} value={ploiPhp} onChange={(e) => setPloiPhp(e.target.value)} placeholder="8.4" /></Field>
          </div>
          <Field label="Platform API URL" hint="serves the provisioning manifest; injected as MISTER_CHAMELEON_API_URL"><input className={inputCls} value={ploiUrl} onChange={(e) => setPloiUrl(e.target.value)} /></Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={ploiPending}
              onClick={() => ploiStart(async () => {
                const r = await savePloiSettingsAction({
                  apiToken: ploiToken || undefined, team: ploiTeam, phpVersion: ploiPhp, platformApiUrl: ploiUrl,
                });
                setPloiMsg(r.ok ? { kind: "ok", text: "Saved." } : { kind: "err", text: r.error });
                if (r.ok) setPloiToken("");
              })}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {ploiPending ? "Saving…" : "Save Ploi"}
            </button>
            <button
              type="button"
              disabled={ploiPending}
              onClick={() => ploiStart(async () => {
                const r = await testPloiConnectionAction();
                setPloiMsg(r.ok ? { kind: "ok", text: r.message } : { kind: "err", text: r.error });
              })}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700"
            >
              Test
            </button>
            <Status msg={ploiMsg} />
          </div>
        </div>
      </section>
    </div>
  );
}
