# Wiring plan — HeroCarousel & FloatingContactBlock

Two finished, lint-clean components live next to this file:

- `FloatingContactBlock.tsx` — sticky phone/e-mail/WhatsApp rail (server component).
- `HeroCarousel.tsx` — rotating hero (autoplay + arrows + dots, client component).

They are **not yet wired** into the CMS authoring chain. Below is the exact,
file-by-file plan. Do this in an environment where you can run `npm run build`
(the chain spans 3 type layers — eslint alone won't catch a mismatch) and
validate on the Vercel staging preview with `?tenant=statamic`.

---

## A. FloatingContactBlock — new content block

1. **`cms/types.ts`** — add the CMS section type + union member:
   ```ts
   export interface FloatingContactSectionData extends PageSectionBase {
     _type: "floatingContact";
     phone?: string; email?: string; whatsapp?: string;
     side?: "right" | "left";
   }
   // add `| FloatingContactSectionData` to the `PageSectionData` union (~line 1969)
   ```

2. **`page-config/types.ts`**
   - add `"floatingContact"` to the `ContentBlockKey` union;
   - add a page-config data type `FloatingContactBlockData` (phone/email/whatsapp/side);
   - add a `ContentBlock` union member `{ blockType: "floatingContact"; data: FloatingContactBlockData }`.

3. **`page-config/registry.ts`**
   - add a `BLOCK_REGISTRY` array entry `{ key: "floatingContact", displayName: "Floating contact", category: "conversion", allowedVariants: ["default"], dataType: "FloatingContactBlockData", status: "live" }`;
   - add `"floatingContact"` to `REGISTERED_CONTENT_BLOCK_TYPES`.

4. **`cms/mappers/page-config-mapper.ts`** — add a `case "floatingContact"` in
   `mapSectionToBlock` returning `{ blockType: "floatingContact", data: { phone, email, whatsapp, side } }`.

5. **`components/platform/ContentBlockRenderer.tsx`** — import `FloatingContactBlock`
   (from `@/components/blocks/FloatingContactBlock`, or move it into
   `components/blocks/sections/` + the barrel) and add
   `case "floatingContact": return <FloatingContactBlock data={block.data} />;`

6. **`cms/mappers/statamic/…`** (mapStatamicPageBlocksToSections) — map the
   `floating_contact` set → `{ _type: "floatingContact", phone, email, whatsapp, side }`.

7. **`provisioning/statamic/fieldsets/mrc_floating_contact.yaml`** — new fieldset
   with `phone` (text), `email` (text), `whatsapp` (text), `side` (select: right/left).

8. **`provisioning/statamic/fieldsets/mc_page_blocks.yaml`** — add a
   `floating_contact` set to the `conversion_and_forms` group, importing
   `mrc_floating_contact`, with icon/instructions/image (preview PNG optional).

---

## B. HeroCarousel — new hero layout variant

1. **`page-config/block-variants.ts`** — add `"hero_carousel"` to `HeroLayoutVariant`.

2. **Hero data** — extend the hero context-slot/blueprint to carry a `slides`
   array (heading/subheading/media/cta per slide). This touches the hero variant
   blueprint + the statamic hero mapper.

3. **`components/blocks/HeroBlock.tsx`** — when `layoutVariant === "hero_carousel"`
   and `slides.length > 0`, render `<HeroCarousel slides={…} autoplay intervalMs={…} />`.

4. **Mapper** — map the CMS `slides` repeater → `HeroCarouselSlide[]`.

---

## Validation

- `npm run build` (typecheck the 3 layers).
- Push to a branch → open the Vercel staging preview → `…/?tenant=statamic`.
- Add the new block / hero variant to a page in the CMS, confirm it renders, and
  check draft / Live Preview still works.
