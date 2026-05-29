/**
 * Storyblok Management API v1 Client
 *
 * A server-only write client for the Storyblok Management API.
 * Used by StoryblokProvider.provisionSite() to create and update stories
 * during tenant provisioning.
 *
 * ─── Storyblok Management API v1 ─────────────────────────────────────────────
 *
 *   Base URL:  https://mapi.storyblok.com/v1
 *   Auth:      Authorization: <management_token>  (Bearer, in header)
 *   Space:     identified by numeric spaceId
 *
 *   Key endpoints used:
 *     GET  /spaces/{spaceId}/stories/?by_slugs={fullSlug}   find story by slug
 *     GET  /spaces/{spaceId}/stories/?folder_only=1&slug={s} find folder by slug
 *     POST /spaces/{spaceId}/stories/                        create story/folder
 *     PUT  /spaces/{spaceId}/stories/{storyId}              update story
 *
 *   Stories are published by passing `"publish": 1` in the request body.
 *
 * ─── Upsert strategy ─────────────────────────────────────────────────────────
 *
 *   Storyblok has no native "createOrReplace" endpoint.  upsertStory() emulates
 *   it by:
 *     1. Looking up the story by full_slug via the `by_slugs` filter.
 *     2. Creating (POST) when not found; updating (PUT) when found.
 *     3. Passing `"publish": 1` in both cases so the story is immediately live.
 *
 * ─── Folder management ───────────────────────────────────────────────────────
 *
 *   ensureFolder() looks up an existing folder by slug (folder_only=1 filter)
 *   and creates it if absent.  Returns the Storyblok story ID of the folder,
 *   which is used as `parent_id` for the stories placed inside it.
 *
 * ─── Server-only ─────────────────────────────────────────────────────────────
 *
 *   The management token is a secret — this module must only ever be imported
 *   from Server Actions or API routes.  Never import from a client component.
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   STORYBLOK_MANAGEMENT_TOKEN   required  Personal access token from Storyblok
 *   STORYBLOK_SPACE_ID           required  Numeric space ID
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const MAPI_BASE = "https://mapi.storyblok.com/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Component schema types ─────────────────────────────────────────────────

/**
 * Supported Storyblok field types used for component schema provisioning.
 * Covers every type used in this platform's component definitions.
 */
export type StoryblokFieldType =
  | "text"
  | "textarea"
  | "bloks"
  | "boolean"
  | "option"
  | "options"
  | "number"
  | "asset";

/** Definition of a single field inside a Storyblok component schema. */
export interface StoryblokComponentFieldDef {
  type: StoryblokFieldType;
  display_name?: string;
  /** Visual position in the editor (ascending). */
  pos?: number;
  /** For `bloks` type: only allow the listed component names. */
  restrict_components?: boolean;
  /** For `bloks` type: allowed component names when restrict_components is true. */
  component_whitelist?: string[];
  /** For `option` / `options` type: the selectable values. */
  options?: Array<{ value: string; name: string }>;
  required?: boolean;
}

/**
 * Input for creating or updating a Storyblok component schema.
 *
 * is_root    — the component can be the root content object of a story.
 * is_nestable — the component can be nested inside a `bloks` field.
 * Both flags can be true simultaneously (e.g. siteSettings can be a root story
 * but also referenced as a block elsewhere).
 */
export interface StoryblokComponentDef {
  name: string;
  display_name?: string;
  is_root?: boolean;
  is_nestable?: boolean;
  schema: Record<string, StoryblokComponentFieldDef>;
}

/** Raw component entry returned by the Management API (subset). */
export interface StoryblokManagedComponent {
  /** Storyblok internal numeric component ID */
  id: number;
  /** Component technical name (unique per space) */
  name: string;
}

// ── Story types ────────────────────────────────────────────────────────────

/** Storyblok Management API story object (subset of fields used here). */
export interface StoryblokManagedStory {
  /** Storyblok internal numeric story ID */
  id: number;
  /** Display name shown in the Storyblok editor */
  name: string;
  /** Story slug — leaf segment only, e.g. "hero_default" */
  slug: string;
  /** Full path including folder, e.g. "hero-variants/hero_default" */
  full_slug: string;
  /** Numeric ID of the containing folder; 0 = root */
  parent_id: number | null;
  /** true when this entry is a folder rather than a story */
  is_folder: boolean;
  /** Whether the story has a published version */
  published: boolean;
  /** The story's content fields — component-specific */
  content: Record<string, unknown>;
}

/** Input to upsertStory() */
export interface UpsertStoryInput {
  /** Story display name (shown in editor sidebar) */
  name: string;
  /** Leaf slug — no slashes, e.g. "hero_default". The folder prefix is
   *  derived from parentId when looking up existing stories via by_slugs. */
  slug: string;
  /** Full slug including folder, e.g. "hero-variants/hero_default".
   *  Used for the by_slugs lookup to find existing stories. */
  fullSlug: string;
  /** Numeric folder ID returned by ensureFolder(). 0 = root. */
  parentId: number;
  /** Component content object — must include `component` key. */
  content: Record<string, unknown>;
  /**
   * Override the URL that Storyblok's "Open preview" button opens.
   *
   * By default Storyblok builds the preview URL as `{domain}/{full_slug}`.
   * For variant stories (hero-variants/*, proof-variants/*, etc.) that path
   * has no matching Next.js route.  Pass the homepage path ("/") so the
   * editor always opens the page where these variants are actually rendered.
   */
  previewUrl?: string;
}

/** Result of a single upsertStory() call */
export interface UpsertStoryResult {
  /** Storyblok numeric story ID */
  storyId: number;
  /** Full slug of the created/updated story */
  fullSlug: string;
  /** "created" when POST was used; "updated" when PUT was used */
  action: "created" | "updated";
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Thin Storyblok Management API v1 client.
 *
 * The management token and space ID are stored at construction time and
 * never logged.  All responses are parsed as JSON; non-2xx responses throw
 * an Error with a human-readable message.
 *
 * @example
 *   const client = new StoryblokManagementClient(token, spaceId);
 *   const folderId = await client.ensureFolder("hero-variants", "hero-variants");
 *   const result = await client.upsertStory({ ... });
 */
export class StoryblokManagementClient {
  private readonly headers: Record<string, string>;
  private readonly spaceId: string;

  /**
   * Minimum interval between consecutive Management API requests (ms).
   * Storyblok enforces a 6 req/s limit; 250 ms gives a comfortable 4 req/s max
   * so a single provisioning run never triggers a 429.
   */
  private readonly MIN_INTERVAL_MS = 250;
  private lastRequestAt = 0;

  constructor(
    private readonly token: string,
    spaceId: string,
  ) {
    // Storyblok shows the space ID as "# 123456" in the dashboard — strip any
    // leading '#' and whitespace so a copy-paste doesn't break the API URLs.
    this.spaceId = spaceId.trim().replace(/^#\s*/, "");
    this.headers = {
      "Content-Type":  "application/json",
      "Authorization": token,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Fetch a story by its full slug (folder path + story slug).
   *
   * Uses the `by_slugs` filter on the Management API stories list endpoint.
   *
   * @returns The story, or null when not found.
   */
  async getStoryByFullSlug(fullSlug: string): Promise<StoryblokManagedStory | null> {
    const url = `${MAPI_BASE}/spaces/${this.spaceId}/stories/?by_slugs=${encodeURIComponent(fullSlug)}`;
    const data = await this.request<{ stories: StoryblokManagedStory[] }>("GET", url);
    return data.stories?.[0] ?? null;
  }

  /**
   * Ensure a folder exists at the given slug, creating it if absent.
   *
   * @param name    Display name for the folder (shown in the editor sidebar).
   * @param slug    Leaf slug of the folder, e.g. "hero-variants".
   * @param parentId  Parent folder ID; 0 = root. Defaults to 0.
   * @returns The numeric story ID of the folder — used as `parent_id` for
   *          stories placed inside it.
   */
  async ensureFolder(name: string, slug: string, parentId = 0): Promise<number> {
    // 1. Check for an existing folder at this slug
    const existingFolder = await this.getFolderBySlug(slug, parentId);
    if (existingFolder) return existingFolder.id;

    // 2. Check if a regular (non-folder) story occupies this slug.
    //    This happens when a listing page like "cases" was seeded before the
    //    entity-detail folder was needed.  Storyblok only accepts folder story
    //    IDs as parent_id, so we must delete the regular story first and then
    //    create a proper folder.  The regular story's content will be re-applied
    //    by upsertStory() later in the seed run (idempotent).
    const existingStory = await this.getStoryByFullSlug(slug);
    if (existingStory && !existingStory.is_folder) {
      await this.deleteStory(existingStory.id);
    }

    // 3. Create the folder
    const body = {
      story: {
        name,
        slug,
        parent_id:  parentId || null,
        is_folder:  true,
        content:    {},
      },
    };
    const url  = `${MAPI_BASE}/spaces/${this.spaceId}/stories/`;
    const data = await this.request<{ story: StoryblokManagedStory }>("POST", url, body);
    return data.story.id;
  }

  /**
   * Permanently delete a story (or folder) by its numeric ID.
   *
   * Used by ensureFolder() to remove a regular page story that occupies a
   * slug needed for a folder.  The story's content will be re-seeded by a
   * subsequent upsertStory() call in the same provisioning run.
   *
   * @throws Error on non-2xx response.
   */
  async deleteStory(storyId: number): Promise<void> {
    const url = `${MAPI_BASE}/spaces/${this.spaceId}/stories/${storyId}`;
    await this.request<unknown>("DELETE", url);
  }

  /**
   * Create or update a story, then publish it.
   *
   * Looks up the story by fullSlug; creates with POST when absent, updates
   * with PUT when found.  Both operations pass `"publish": 1` to immediately
   * make the story live.
   *
   * @returns UpsertStoryResult with the action taken ("created" | "updated")
   *          and the story ID.
   */
  async upsertStory(input: UpsertStoryInput): Promise<UpsertStoryResult> {
    const existing = await this.getStoryByFullSlug(input.fullSlug);

    const body = {
      story: {
        name:        input.name,
        slug:        input.slug,
        parent_id:   input.parentId || null,
        content:     input.content,
        ...(input.previewUrl ? { preview_url: input.previewUrl } : {}),
      },
      publish: 1,
    };

    if (existing) {
      // Update existing story
      const url  = `${MAPI_BASE}/spaces/${this.spaceId}/stories/${existing.id}`;
      const data = await this.request<{ story: StoryblokManagedStory }>("PUT", url, body);
      return {
        storyId:  data.story.id,
        fullSlug: data.story.full_slug,
        action:   "updated",
      };
    }

    // Create new story
    const url  = `${MAPI_BASE}/spaces/${this.spaceId}/stories/`;
    const data = await this.request<{ story: StoryblokManagedStory }>("POST", url, body);
    return {
      storyId:  data.story.id,
      fullSlug: data.story.full_slug,
      action:   "created",
    };
  }

  /**
   * Test connectivity by fetching space info.
   *
   * A successful GET /spaces/{spaceId} confirms the token is valid and the
   * space ID is correct.
   *
   * @returns ok: true with the space name on success; ok: false with a
   *          human-readable error on any failure.
   */
  async testConnection(): Promise<
    | { ok: true;  spaceName: string }
    | { ok: false; error: string; hint?: string }
  > {
    const url = `${MAPI_BASE}/spaces/${this.spaceId}`;
    try {
      const data = await this.request<{ space: { name: string } }>("GET", url);
      return { ok: true, spaceName: data.space?.name ?? "(unnamed)" };
    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      let hint: string | undefined;
      if (lower.includes("401") || lower.includes("unauthorized")) {
        hint = "Management token is invalid or expired. Create a new Personal Access Token in Storyblok → My Account → Personal Access Tokens.";
      } else if (lower.includes("403") || lower.includes("forbidden")) {
        hint = "Token does not have access to this space.";
      } else if (lower.includes("404") || lower.includes("not found")) {
        hint = "Space ID not found. Check the numeric Space ID in Storyblok → Settings → General.";
      } else if (lower.includes("enotfound") || lower.includes("network")) {
        hint = "Network error — check your internet connection.";
      }
      return { ok: false, error: msg, hint };
    }
  }

  // ── Component schema management ─────────────────────────────────────────────

  /**
   * Fetch all component schemas defined in the space.
   *
   * Returns an array of { id, name } entries — enough to look up existing
   * components by name before deciding whether to POST or PUT.
   */
  async listComponents(): Promise<StoryblokManagedComponent[]> {
    const url  = `${MAPI_BASE}/spaces/${this.spaceId}/components/`;
    const data = await this.request<{ components: StoryblokManagedComponent[] }>("GET", url);
    return data.components ?? [];
  }

  /**
   * Create or update a component schema.
   *
   * Looks up any existing component with the same `name`.  When found it
   * issues a PUT to update the schema in place; otherwise it POSTs a new one.
   *
   * Uses the `existingComponents` map (pre-fetched by the caller) to avoid
   * an extra GET per component during a bulk-provision run.
   *
   * @param def               Component definition to upsert.
   * @param existingComponents  Map of { name → id } built from listComponents().
   * @returns "created" or "updated"
   */
  async upsertComponent(
    def: StoryblokComponentDef,
    existingComponents: Map<string, number>,
  ): Promise<"created" | "updated"> {
    const body = {
      component: {
        name:         def.name,
        display_name: def.display_name ?? def.name,
        is_root:      def.is_root      ?? false,
        is_nestable:  def.is_nestable  ?? true,
        schema:       def.schema,
      },
    };

    const existingId = existingComponents.get(def.name);

    if (existingId !== undefined) {
      const url = `${MAPI_BASE}/spaces/${this.spaceId}/components/${existingId}`;
      await this.request("PUT", url, body);
      return "updated";
    }

    const url = `${MAPI_BASE}/spaces/${this.spaceId}/components/`;
    await this.request("POST", url, body);
    return "created";
  }

  /**
   * Set the preview domain for the Storyblok space.
   *
   * The domain is the base URL of the Next.js app (e.g. "https://app.example.com").
   * Storyblok appends the story's slug to build the preview URL, so pressing
   * "Open preview" in the editor opens `{domain}/{slug}` — which maps directly
   * to the Next.js app's public pages.
   *
   * Silently skips when `domain` is empty so callers can pass
   * `process.env.NEXT_PUBLIC_APP_URL` directly without null-checking.
   */
  async setPreviewDomain(domain: string): Promise<void> {
    if (!domain) return;
    const url  = `${MAPI_BASE}/spaces/${this.spaceId}/`;
    await this.request("PUT", url, { space: { domain } });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Find a folder story by its leaf slug within a parent.
   *
   * Uses `folder_only=1` to restrict the results to folders, then matches
   * by slug rather than by_slugs (since folders may not be found via by_slugs
   * depending on Storyblok plan tier).
   */
  private async getFolderBySlug(
    slug: string,
    parentId: number,
  ): Promise<StoryblokManagedStory | null> {
    const params = new URLSearchParams({
      folder_only: "1",
      per_page:    "100",
    });
    if (parentId > 0) {
      params.set("with_parent", String(parentId));
    }
    const url  = `${MAPI_BASE}/spaces/${this.spaceId}/stories/?${params}`;
    const data = await this.request<{ stories: StoryblokManagedStory[] }>("GET", url);
    return data.stories?.find((s) => s.slug === slug) ?? null;
  }

  /**
   * Enforce the per-instance rate limit before each API call.
   *
   * Waits until at least MIN_INTERVAL_MS has elapsed since the last request.
   * Because provisioning runs sequentially this is sufficient; it does NOT
   * handle concurrent callers from multiple instances.
   */
  private async rateLimit(): Promise<void> {
    const now     = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.MIN_INTERVAL_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.MIN_INTERVAL_MS - elapsed),
      );
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * Execute a Management API request and parse the JSON response.
   *
   * @param method  HTTP method
   * @param url     Fully-qualified Management API URL
   * @param body    Optional JSON body (for POST/PUT)
   * @throws Error  For non-2xx responses, with a human-readable message
   *                that includes the HTTP status and Storyblok error text.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url:    string,
    body?:  unknown,
  ): Promise<T> {
    await this.rateLimit();

    const response = await fetch(url, {
      method,
      headers: this.headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      // Skip Next.js ISR caching for all management API calls — these are
      // write operations or lookups that must always be fresh.
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errBody = await response.text();
        detail = errBody ? ` — ${errBody.slice(0, 300)}` : "";
      } catch {
        // ignore parse failure
      }
      throw new Error(
        `Storyblok Management API ${method} ${url}: HTTP ${response.status} ${response.statusText}${detail}`,
      );
    }

    // DELETE / 204 — no body
    if (response.status === 204) return {} as T;

    return (await response.json()) as T;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a StoryblokManagementClient from the given credentials.
 *
 * Credentials are resolved in priority order by the caller (provisionSite):
 *   1. Platform settings DB (managementToken, spaceId)
 *   2. STORYBLOK_MANAGEMENT_TOKEN / STORYBLOK_SPACE_ID env vars
 */
export function createStoryblokManagementClient(
  managementToken: string,
  spaceId: string,
): StoryblokManagementClient {
  return new StoryblokManagementClient(managementToken, spaceId);
}
