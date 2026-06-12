/**
 * Laravel Forge API Client
 *
 * Thin fetch-based wrapper around the Forge REST API.
 * All methods are server-only — the API token must never be exposed to clients.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const forge = new ForgeClient(apiToken);
 *
 *   const servers   = await forge.listServers();
 *   const site      = await forge.createSite(serverId, { domain, ... });
 *   await forge.installGit(serverId, site.id, { repository, branch });
 *   await forge.updateEnv(serverId, site.id, envContent);
 *   await forge.deploy(serverId, site.id);
 *   const deployment = await forge.pollDeployment(serverId, site.id, deploymentId);
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   All methods throw `ForgeClientError` on non-2xx responses.
 *   Callers should catch and wrap as appropriate.
 */

import type {
  ForgeServer,
  ForgeServersResponse,
  ForgeSite,
  ForgeSiteResponse,
  ForgeGitConfig,
  ForgeEnvResponse,
  ForgeDeployment,
  ForgeDeploymentResponse,
  ForgeCommandResult,
  ForgeCommandResponse,
  CreateForgeSubjectInput,
} from "./types";

const FORGE_API_BASE = "https://forge.laravel.com/api/v1";

// ── Error class ────────────────────────────────────────────────────────────────

export class ForgeClientError extends Error {
  constructor(
    public readonly status:  number,
    public readonly body:    string,
    message:                 string,
  ) {
    super(message);
    this.name = "ForgeClientError";
  }
}

// ── Client ─────────────────────────────────────────────────────────────────────

export class ForgeClient {
  constructor(private readonly apiToken: string) {}

  // ── Low-level fetch ──────────────────────────────────────────────────────────

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path:   string,
    body?:  unknown,
  ): Promise<T> {
    const url  = `${FORGE_API_BASE}${path}`;
    const opts: RequestInit = {
      method,
      headers: {
        Authorization:  `Bearer ${this.apiToken}`,
        Accept:         "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    };

    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const resp = await fetch(url, opts);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      let message = `Forge API error ${resp.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        // ignore JSON parse error
      }
      throw new ForgeClientError(resp.status, text, message);
    }

    // 204 No Content
    if (resp.status === 204) {
      return undefined as unknown as T;
    }

    return resp.json() as Promise<T>;
  }

  // ── Servers ──────────────────────────────────────────────────────────────────

  async listServers(): Promise<ForgeServer[]> {
    const data = await this.request<ForgeServersResponse>("GET", "/servers");
    return data.servers;
  }

  async getServer(serverId: number): Promise<ForgeServer> {
    const data = await this.request<{ server: ForgeServer }>("GET", `/servers/${serverId}`);
    return data.server;
  }

  // ── Sites ────────────────────────────────────────────────────────────────────

  async listSites(serverId: number): Promise<ForgeSite[]> {
    const data = await this.request<{ sites: ForgeSite[] }>("GET", `/servers/${serverId}/sites`);
    return data.sites;
  }

  async createSite(
    serverId: number,
    input:    CreateForgeSubjectInput,
  ): Promise<ForgeSite> {
    const data = await this.request<ForgeSiteResponse>(
      "POST",
      `/servers/${serverId}/sites`,
      input,
    );
    return data.site;
  }

  async getSite(serverId: number, siteId: number): Promise<ForgeSite> {
    const data = await this.request<ForgeSiteResponse>(
      "GET",
      `/servers/${serverId}/sites/${siteId}`,
    );
    return data.site;
  }

  /** Poll `getSite` until status === "installed" or until `timeoutMs`. */
  async waitForSiteInstalled(
    serverId:  number,
    siteId:    number,
    timeoutMs: number = 120_000,
    pollMs:    number = 3_000,
  ): Promise<ForgeSite> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const site = await this.getSite(serverId, siteId);
      if (site.status === "installed") return site;
      if (site.status === "failed")
        throw new ForgeClientError(0, "", `Site ${siteId} provisioning failed`);
      await sleep(pollMs);
    }
    throw new ForgeClientError(0, "", `Timed out waiting for site ${siteId} to install`);
  }

  // ── Git repository ───────────────────────────────────────────────────────────

  async installGit(
    serverId: number,
    siteId:   number,
    config:   ForgeGitConfig,
  ): Promise<ForgeSite> {
    const data = await this.request<ForgeSiteResponse>(
      "POST",
      `/servers/${serverId}/sites/${siteId}/git`,
      config,
    );
    return data.site;
  }

  // ── Environment ──────────────────────────────────────────────────────────────

  async getEnv(serverId: number, siteId: number): Promise<string> {
    const data = await this.request<ForgeEnvResponse>(
      "GET",
      `/servers/${serverId}/sites/${siteId}/env`,
    );
    return data.content ?? "";
  }

  async updateEnv(
    serverId: number,
    siteId:   number,
    content:  string,
  ): Promise<void> {
    await this.request<void>(
      "PUT",
      `/servers/${serverId}/sites/${siteId}/env`,
      { content },
    );
  }

  // ── Deployment ───────────────────────────────────────────────────────────────

  async deploy(serverId: number, siteId: number): Promise<ForgeDeployment> {
    const data = await this.request<ForgeDeploymentResponse>(
      "POST",
      `/servers/${serverId}/sites/${siteId}/deployment/deploy`,
    );
    return data.deployment;
  }

  async getLatestDeployment(serverId: number, siteId: number): Promise<ForgeDeployment | null> {
    try {
      const data = await this.request<ForgeDeploymentResponse>(
        "GET",
        `/servers/${serverId}/sites/${siteId}/deployment-history/latest`,
      );
      return data.deployment ?? null;
    } catch {
      return null;
    }
  }

  /** Poll deployment until "finished" or "failed". */
  async pollDeployment(
    serverId:     number,
    siteId:       number,
    timeoutMs:    number = 300_000,
    pollMs:       number = 5_000,
  ): Promise<ForgeDeployment> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const dep = await this.getLatestDeployment(serverId, siteId);
      if (!dep) {
        await sleep(pollMs);
        continue;
      }
      if (dep.status === "finished") return dep;
      if (dep.status === "failed")
        throw new ForgeClientError(0, dep.status, `Deployment failed for site ${siteId}`);
      await sleep(pollMs);
    }
    throw new ForgeClientError(0, "", `Timed out waiting for deployment on site ${siteId}`);
  }

  // ── Commands (artisan / shell) ───────────────────────────────────────────────

  async runCommand(
    serverId: number,
    siteId:   number,
    command:  string,
  ): Promise<ForgeCommandResult> {
    const data = await this.request<ForgeCommandResponse>(
      "POST",
      `/servers/${serverId}/sites/${siteId}/commands`,
      { command },
    );
    return data.command;
  }

  async pollCommand(
    serverId:   number,
    siteId:     number,
    commandId:  number,
    timeoutMs:  number = 120_000,
    pollMs:     number = 3_000,
  ): Promise<ForgeCommandResult> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const data = await this.request<ForgeCommandResponse>(
        "GET",
        `/servers/${serverId}/sites/${siteId}/commands/${commandId}`,
      );
      const cmd = data.command;
      if (cmd.status === "finished") return cmd;
      if (cmd.status === "failed")
        throw new ForgeClientError(0, cmd.output ?? "", `Command ${commandId} failed`);
      await sleep(pollMs);
    }
    throw new ForgeClientError(0, "", `Timed out waiting for command ${commandId}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
