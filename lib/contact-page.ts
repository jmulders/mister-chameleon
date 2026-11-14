/**
 * Contact page: which content does /contact render?
 *
 * /contact has a route of its own, so it never reaches app/(site)/[slug]. Until
 * 14 Nov 2026 that route only looked for the page on disk (STATAMIC_CMS_PATH).
 * Production reaches the CMS over its REST API, so the published CMS page was
 * never shown there and every visitor got the built-in page.
 *
 * The route now asks the tenant's CMS provider, like every other marketing
 * page. These helpers hold the two decisions that route makes, without any
 * Next.js imports, so they can be tested directly.
 */

import type { CMSProvider }                         from "@/cms/providers/cms-provider";
import type { FormSectionData, PageData }           from "@/cms/types";

/** Key of the form section added by withContactForm(). */
export const CONTACT_FORM_SECTION_KEY = "contact-form-default";

/**
 * The CMS contact page, or null when the built-in page should be shown: the
 * CMS has no contact page, the page has no blocks, or the CMS did not answer.
 * Never throws.
 */
export async function loadCmsContactPage(
  provider: Pick<CMSProvider, "getPageBySlug">,
  locale:   string,
): Promise<PageData | null> {
  try {
    const page = await provider.getPageBySlug("contact", locale);
    if (!page || page.sections.length === 0) return null;
    return page;
  } catch {
    return null;
  }
}

/**
 * A contact page always has a form.
 *
 * A Statamic form block points at a form by its handle. Over the REST API that
 * handle only survives when a form with that handle exists in the CMS itself:
 * without it the API answers `form: null` and the mapper drops the block (it
 * cannot render a form without a key). The contact form lives in the platform
 * (forms/definitions/contact.ts), so a CMS can easily have no form by that
 * name, and the page would then render without any way to send a message.
 *
 * When the page has no form section, the platform contact form is added at the
 * end. A page that does have one is returned as it is.
 */
export function withContactForm(page: PageData): PageData {
  if (page.sections.some((section) => section._type === "formSection")) return page;

  const form: FormSectionData = {
    _key:    CONTACT_FORM_SECTION_KEY,
    _type:   "formSection",
    variant: "form_inline",
    formKey: "contact",
  };
  return { ...page, sections: [...page.sections, form] };
}
