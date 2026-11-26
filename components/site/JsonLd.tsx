/**
 * A block of structured data in the page. `json` comes from a builder in
 * lib/seo (structured-data.ts, site-identity.ts), which escapes `<`, so no
 * value in it can close the script element.
 */
export function JsonLd({ json }: { json: string }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
