/**
 * Admin — Platform › Design Token Extractor
 *
 * Paste a public website URL; the platform fetches its CSS and distils a
 * grouped design-token set (colours, fonts, radius, shadow) that you can
 * download and import in any tenant's Design → Builder / Advanced import.
 *
 * Accessible at /admin/platform/token-extractor.
 */

import Link from "next/link";
import { TokenExtractorClient } from "./_components/TokenExtractorClient";

export default function TokenExtractorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Design Token Extractor</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Voer een website-URL in. Het platform haalt de CSS op en distilleert een
          importeerbare design-token-set (kleuren, fonts, radius, schaduw). Het
          resultaat is heuristisch — controleer en pas het aan in{" "}
          <Link href="/admin/tenants" className="text-brand-600 font-medium hover:underline">
            een tenant → Design
          </Link>{" "}
          voordat je het opslaat.
        </p>
      </div>

      <TokenExtractorClient />
    </div>
  );
}
