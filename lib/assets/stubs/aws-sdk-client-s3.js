/**
 * Build-time stub for @aws-sdk/client-s3
 *
 * next.config.mjs aliases @aws-sdk/client-s3 to THIS FILE when the real
 * package is not present in node_modules.  The alias is active only at
 * build time — once the package is installed the alias is removed and the
 * real SDK is used automatically.
 *
 * Why a stub instead of letting the build fail?
 *   Cloudflare R2 is an OPTIONAL storage provider.  The vast majority of
 *   deployments use Sanity Assets (default) or Supabase Storage.  Requiring
 *   @aws-sdk/client-s3 to be installed for those deployments would add ~6 MB
 *   of build overhead for a feature that is not in use.
 *
 * At runtime:
 *   If R2 is selected as the active storage provider but @aws-sdk/client-s3
 *   is NOT installed, these stub classes are invoked and throw a clear error
 *   directing the developer to install the package and rebuild.
 *
 * To enable Cloudflare R2:
 *   1. npm install @aws-sdk/client-s3
 *   2. rm -rf .next
 *   3. npm run build   (or restart the dev server)
 *   4. Set provider to "cloudflare_r2" in Admin → Platform → Storage
 */

"use strict";

const NOT_INSTALLED =
  "[r2-storage] @aws-sdk/client-s3 is not installed.\n" +
  "Cloudflare R2 requires this package. Steps to enable R2:\n" +
  "  1. npm install @aws-sdk/client-s3\n" +
  "  2. rm -rf .next\n" +
  "  3. npm run build  (or restart dev server)\n" +
  "Alternatively, switch to a different provider: Admin → Platform → Storage.";

function makeStub(className) {
  const Stub = class {
    constructor() {
      throw new Error(`${className} — ${NOT_INSTALLED}`);
    }
    send() {
      throw new Error(`${className}.send() — ${NOT_INSTALLED}`);
    }
  };
  Object.defineProperty(Stub, "name", { value: className });
  return Stub;
}

module.exports = {
  S3Client:            makeStub("S3Client"),
  PutObjectCommand:    makeStub("PutObjectCommand"),
  DeleteObjectCommand: makeStub("DeleteObjectCommand"),
  HeadBucketCommand:   makeStub("HeadBucketCommand"),
  GetObjectCommand:    makeStub("GetObjectCommand"),
  ListObjectsV2Command: makeStub("ListObjectsV2Command"),
};
