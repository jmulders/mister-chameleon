/**
 * What the admin may ask GitHub Actions to run.
 *
 * The dispatch route forwards its input to the GitHub API with the server's
 * token, so the input is checked here first: a fixed list of workflow files
 * (the name goes into the API path), a plain branch or tag name, and string
 * inputs only.
 *
 * Pure: no I/O.
 */

/** The workflows the System page has a button for. */
export const DISPATCHABLE_WORKFLOWS = ["production.yml", "staging.yml", "rollback.yml"] as const;
export type DispatchableWorkflow = (typeof DISPATCHABLE_WORKFLOWS)[number];

export type WorkflowDispatch = {
  workflow: DispatchableWorkflow;
  ref:      string;
  inputs:   Record<string, string>;
};

export type ParsedDispatch =
  | { ok: true;  value: WorkflowDispatch }
  | { ok: false; error: string };

const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;
const INPUT_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_INPUTS = 10;
const MAX_INPUT_LENGTH = 500;

export function parseWorkflowDispatch(body: unknown): ParsedDispatch {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid body" };
  }
  const { workflow, ref = "main", inputs = {} } = body as Record<string, unknown>;

  if (typeof workflow !== "string" || !(DISPATCHABLE_WORKFLOWS as readonly string[]).includes(workflow)) {
    return { ok: false, error: `workflow must be one of: ${DISPATCHABLE_WORKFLOWS.join(", ")}` };
  }
  if (typeof ref !== "string" || !REF.test(ref) || ref.includes("..")) {
    return { ok: false, error: "ref must be a branch or tag name" };
  }
  if (typeof inputs !== "object" || inputs === null || Array.isArray(inputs)) {
    return { ok: false, error: "inputs must be an object" };
  }

  const entries = Object.entries(inputs as Record<string, unknown>);
  if (entries.length > MAX_INPUTS) return { ok: false, error: "Too many inputs" };

  const clean: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!INPUT_KEY.test(key)) return { ok: false, error: `Invalid input name: ${key.slice(0, 40)}` };
    if (typeof value !== "string" || value.length > MAX_INPUT_LENGTH) {
      return { ok: false, error: `Input ${key} must be a string of at most ${MAX_INPUT_LENGTH} characters` };
    }
    clean[key] = value;
  }

  return { ok: true, value: { workflow: workflow as DispatchableWorkflow, ref, inputs: clean } };
}
