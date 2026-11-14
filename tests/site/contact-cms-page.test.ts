/**
 * /contact renders the tenant's CMS contact page through the CMS provider.
 *
 * Until 14 Nov 2026 the route only read contact.md from disk
 * (STATAMIC_CMS_PATH). Production reaches the CMS over its REST API, so the
 * published page was never shown there and every visitor got the built-in
 * page.
 *
 * The blocks below are the shape cms.misterchameleon.nl answered with on that
 * day, trimmed to the fields the mapper reads. Note `form: null`: the entry
 * points at the form "contact", but no Statamic form with that handle exists
 * in the CMS, so the REST API cannot hand the handle over.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mapStatamicPageBlocksToSections } from "../../cms/mappers/statamic/statamic-mappers.ts";
import { mapPageDataToPageConfig }         from "../../cms/mappers/page-config-mapper.ts";
import { getFormDefinition, resolveFormKey } from "../../forms/registry.ts";
import {
  CONTACT_FORM_SECTION_KEY,
  loadCmsContactPage,
  withContactForm,
} from "../../lib/contact-page.ts";
import type { PageData } from "../../cms/types.ts";

const select = (value: string) => ({ value, label: value, key: value });

function restBlocks(form: unknown): Array<Record<string, unknown>> {
  return [
    {
      id: "ctx_hero", type: "context_slot",
      slot_type: select("hero"), form_type: { value: null, label: null, key: null },
      variant_key: "hero_default", is_active: true,
    },
    {
      id: "et3LjGCf", type: "image",
      variant: select("text_media_right"),
      heading: "Liever eerst even sparren?",
      body: "Vertel ons kort over je website en je doelgroepen.",
      ctas: [{ id: "p6L2QrGV", label: "Bekijk wat we doen", href: { url: "/functies" } }],
      media_type: select("image"),
      image: {
        id: "assets::mc-tekening-gesprek.svg",
        url: "/assets/mc-tekening-gesprek.svg",
        permalink: "https://cms.misterchameleon.nl/assets/mc-tekening-gesprek.svg",
        alt: null,
      },
      alt: "Twee tekstballonnen",
    },
    {
      id: "ygjkLuXs", type: "form_section",
      variant: select("form_inline"),
      heading: "Stuur ons een bericht",
      subtitle: "We reageren binnen één werkdag.",
      form,
      submit_label: null,
      post_submit: select("message"),
      success_message: null,
      redirect_target: { url: null },
    },
  ];
}

function cmsPage(form: unknown): PageData {
  return {
    id: "contact", title: "Contact", slug: "contact",
    sections: mapStatamicPageBlocksToSections(restBlocks(form), "https://cms.misterchameleon.nl"),
    templateKey: "marketing-page",
  };
}

const providerWith = (page: PageData | null) => ({ getPageBySlug: async () => page });

describe("contact page: which content is shown", () => {
  it("takes the CMS page when the CMS has one", async () => {
    const page = await loadCmsContactPage(providerWith(cmsPage(null)), "nl");
    assert.ok(page);
    assert.deepEqual(page.sections.map((s) => s._type).slice(0, 2), ["contextSlot", "textMedia"]);
    assert.match(JSON.stringify(page.sections), /Liever eerst even sparren\?/);
    assert.match(JSON.stringify(page.sections), /mc-tekening-gesprek\.svg/);
  });

  it("asks for the slug contact in the visitor's language", async () => {
    const asked: Array<[string, string | undefined]> = [];
    await loadCmsContactPage({
      getPageBySlug: async (slug, locale) => { asked.push([slug, locale]); return null; },
    }, "de");
    assert.deepEqual(asked, [["contact", "de"]]);
  });

  it("falls back to the built-in page without a CMS page", async () => {
    assert.equal(await loadCmsContactPage(providerWith(null), "nl"), null);
  });

  it("falls back when the CMS page has no blocks", async () => {
    const empty: PageData = { id: "contact", title: "Contact", slug: "contact", sections: [] };
    assert.equal(await loadCmsContactPage(providerWith(empty), "nl"), null);
  });

  it("falls back when the CMS cannot be reached", async () => {
    const down = { getPageBySlug: async () => { throw new Error("ECONNREFUSED"); } };
    assert.equal(await loadCmsContactPage(down, "nl"), null);
  });
});

describe("contact page: the form", () => {
  it("adds the platform contact form when the CMS hands over no form", () => {
    // `form: null` makes the mapper drop the form block. Without the net the
    // contact page would render a hero and an image, and no form at all.
    const fromCms = cmsPage(null);
    assert.equal(fromCms.sections.some((s) => s._type === "formSection"), false);

    const page  = withContactForm(fromCms);
    const types = page.sections.map((s) => s._type);
    assert.deepEqual(types, ["contextSlot", "textMedia", "formSection"]);

    const block = mapPageDataToPageConfig(page).contentBlocks.find((b) => b.blockType === "formSection");
    assert.equal(block?.id, CONTACT_FORM_SECTION_KEY);
    assert.equal((block?.data as { formKey: string }).formKey, "contact");
  });

  it("leaves a page with a linked form as the editor made it", () => {
    for (const form of ["contact", ["contact"], { handle: "contact", title: "Contact" }]) {
      const fromCms = cmsPage(form);
      const page    = withContactForm(fromCms);
      assert.equal(page, fromCms);

      const forms = page.sections.filter((s) => s._type === "formSection");
      assert.equal(forms.length, 1);
      assert.deepEqual(
        { key: forms[0]!._key, formKey: forms[0]!.formKey, title: forms[0]!.title, intro: forms[0]!.intro },
        { key: "ygjkLuXs", formKey: "contact", title: "Stuur ons een bericht", intro: "We reageren binnen één werkdag." },
      );
    }
  });

  it("points at a form the platform can render and receive", () => {
    // FormSectionBlock renders the fields of this definition and posts to
    // /api/forms/<key>; the route looks the same key up again.
    const added = withContactForm(cmsPage(null)).sections.at(-1) as { formKey: string };
    const key   = resolveFormKey(added.formKey);
    assert.equal(key, "contact");

    const fields = getFormDefinition(key!)!.fields.map((f) => f.key);
    assert.deepEqual(fields, ["name", "email", "message"]);
  });
});

describe("contact route", () => {
  const source = readFileSync("app/(site)/contact/page.tsx", "utf8");

  it("asks the CMS provider, not the disk", () => {
    assert.match(source, /loadCmsContactPage\(createCMSProvider\(tenant\?\.cms, tenantId\), locale\)/);
    assert.doesNotMatch(source, /process\.env\.STATAMIC_CMS_PATH/);
    assert.doesNotMatch(source, /from "fs"/);
  });

  it("keeps the built-in page with its own form", () => {
    assert.match(source, /<ContactForm \/>/);
    assert.match(source, /Stuur ons een bericht/);
  });
});
