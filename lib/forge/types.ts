/**
 * Laravel Forge API — TypeScript types
 *
 * Covers the subset of the Forge API surface used by the Mister Chameleon
 * platform for Statamic site provisioning:
 *
 *   • Servers  — list, get
 *   • Sites    — create, get
 *   • Git      — install repository
 *   • Env      — read, update
 *   • Deploy   — trigger, poll status
 *   • Commands — run artisan / shell commands on a site
 *
 * Reference: https://forge.laravel.com/api-documentation
 */

// ── Servers ────────────────────────────────────────────────────────────────────

export interface ForgeServer {
  id:               number;
  name:             string;
  type:             string;
  /** "active" | "installing" | "failed" */
  status:           string;
  ip_address:       string;
  private_ip_address: string | null;
  php_version:      string;
  /** Human-readable: "1.1.1.1" */
  ssh_port:         number;
  /** ISO-8601 */
  created_at:       string;
}

export interface ForgeServersResponse {
  servers: ForgeServer[];
}

// ── Sites ──────────────────────────────────────────────────────────────────────

export interface ForgeSite {
  id:               number;
  server_id:        number;
  name:             string;
  /** e.g. "php" */
  project_type:     string;
  /** "installed" | "installing" | "failed" */
  status:           string;
  /** e.g. "8.2" */
  php_version:      string;
  /** Path to the site's webroot on the server */
  directory:        string;
  wildcards:        boolean;
  /** Whether the site is behind a load balancer */
  is_secured:       boolean;
  /** ISO-8601 */
  created_at:       string;
}

export interface ForgeSiteResponse {
  site: ForgeSite;
}

export interface CreateForgeSubjectInput {
  domain:       string;
  project_type: "php";
  directory:    string;
  php_version?: string;
}

// ── Git repository ─────────────────────────────────────────────────────────────

export interface ForgeGitConfig {
  provider:           "github" | "gitlab" | "bitbucket" | "custom";
  repository:         string;  // e.g. "org/repo"
  branch:             string;  // e.g. "starter"
  composer:           boolean;
}

// ── Env ────────────────────────────────────────────────────────────────────────

export interface ForgeEnvResponse {
  /** Raw .env file contents as a string. */
  content: string;
}

// ── Deployments ────────────────────────────────────────────────────────────────

export interface ForgeDeployment {
  id:         number;
  server_id:  number;
  site_id:    number;
  /** "finished" | "failed" | "running" */
  status:     string;
  commit_hash:      string | null;
  commit_message:   string | null;
  /** ISO-8601 */
  created_at: string;
  /** ISO-8601 or null while running */
  ended_at:   string | null;
}

export interface ForgeDeploymentResponse {
  deployment: ForgeDeployment;
}

// ── Commands (artisan / shell) ─────────────────────────────────────────────────

export interface ForgeCommandResult {
  id:       number;
  status:   "finished" | "failed" | "running";
  output:   string | null;
  /** ISO-8601 */
  created_at: string;
}

export interface ForgeCommandResponse {
  command: ForgeCommandResult;
}

// ── Error envelope ─────────────────────────────────────────────────────────────

export interface ForgeApiError {
  message: string;
  errors?: Record<string, string[]>;
}
