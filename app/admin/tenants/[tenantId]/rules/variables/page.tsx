/**
 * Admin: Copy Variables
 *
 * Manage the insertable {tokens} for body copy and, per variable, a value map
 * that turns a raw context value into a readable display value (for example
 * device: mobile -> mobiel, or an SBI code -> industry name), with a fallback.
 *
 * The insert-variable dropdown in the copy editor and the render-time
 * substitution both read this registry. When empty, the platform uses the
 * implicit default (curated built-ins + string custom attributes).
 */

import { notFound }      from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { getCopyVariablesAction } from "./actions";
import { VariablesClient } from "./_components/VariablesClient";
import {
  BUILTIN_SOURCE_KEYS,
  builtinSourceLabel,
  defaultCopyVariables,
} from "@/lib/blocks/substitute-context-tokens";

export const dynamic = "force-dynamic";

export interface SourceOption {
  kind:  "builtin" | "custom";
  key:   string;
  label: string;
}

export default async function VariablesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const variables = await getCopyVariablesAction(tenantId);
  const customAttributes = tenant.customAttributes ?? [];

  const sourceOptions: SourceOption[] = [
    ...BUILTIN_SOURCE_KEYS.map((key) => ({ kind: "builtin" as const, key, label: builtinSourceLabel(key) })),
    ...customAttributes.map((a) => ({ kind: "custom" as const, key: a.name, label: `${a.label ?? a.name} (custom)` })),
  ];

  // The implicit default, offered as a one-click "materialize" seed.
  const defaultRegistry = defaultCopyVariables(customAttributes);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Copy variables</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
          Manage the insertable{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">{"{variables}"}</code>{" "}
          for body copy. Each variable reads a source (a built-in context field or
          a declared custom attribute) and can map raw values to readable display
          values (for example device: mobile to mobiel), with a fallback used when
          the value is missing.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-800">
          Resolved values stay untrusted and are HTML-escaped with markup
          neutralised. Stored copy keeps the literal token; substitution happens
          at render time.
        </p>
      </div>

      <VariablesClient
        tenantId={tenantId}
        initialVariables={variables}
        sourceOptions={sourceOptions}
        defaultRegistry={defaultRegistry}
      />
    </div>
  );
}
