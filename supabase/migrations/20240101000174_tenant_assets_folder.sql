-- Virtual folders for the tenant asset library.
--
-- A folder is organization metadata on the asset; physical storage stays flat
-- (storage_path is unchanged). One nullable folder per asset (NULL = unfiled).
-- Folders are virtual: they are derived from this column, so a folder exists
-- exactly while at least one asset is filed under it. Tenant-scoped index so the
-- per-folder browse/filter stays fast.

alter table public.tenant_assets add column if not exists folder text;

create index if not exists tenant_assets_tenant_folder_idx
  on public.tenant_assets (tenant_id, folder);
