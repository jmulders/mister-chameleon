/**
 * /order/[slug]  →  redirect to /pricing
 *
 * Previously rendered a standalone CMS-driven order page.
 * Now redirects directly to the pricing/cart page so visitors
 * land on the unified cart experience regardless of which plan
 * link they clicked (e.g. /order/starter, /order/growth).
 *
 * The `plan` query param is forwarded so the pricing page can
 * optionally highlight or pre-select the intended plan.
 */

import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function OrderRedirectPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/pricing?plan=${encodeURIComponent(slug)}`);
}
