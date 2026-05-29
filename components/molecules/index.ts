/**
 * Molecules — reusable UI compositions barrel
 *
 * The molecules layer sits between atoms (primitives/ui) and blocks. Each
 * molecule is a small, focused composition of atoms that encapsulates a
 * recurring UI pattern. Molecules have no page-level layout responsibility
 * and carry no business logic.
 *
 * ─── Import path ──────────────────────────────────────────────────────────────
 *
 *   import { Accordion, AccordionItem, CTAGroup, … } from "@/components/molecules";
 *
 * ─── Molecule inventory ───────────────────────────────────────────────────────
 *
 *   Accordion / AccordionItem   Progressive-disclosure panels (FAQ, expandable content)
 *   CTAGroup                    Flex row of Button atoms from a BlockCTA array
 *   MetaItem / MetaList         Labelled metadata rows (vacancy / structured detail)
 *   Breadcrumbs                 Accessible nav trail with JSON-LD structured data
 *   Pagination                  URL-param-driven page number controls
 *   FormGroup                   Semantic <fieldset> grouper for form fields
 */

// ── Disclosure ────────────────────────────────────────────────────────────────

export { Accordion, AccordionItem }         from "./Accordion";
export type { AccordionProps, AccordionItemProps } from "./Accordion";

// ── CTAs ──────────────────────────────────────────────────────────────────────

export { CTAGroup }                         from "./CTAGroup";
export type { CTAGroupProps }               from "./CTAGroup";

// ── Metadata ──────────────────────────────────────────────────────────────────

export { MetaItem, MetaList }               from "./MetaList";
export type { MetaItemProps, MetaListProps } from "./MetaList";

// ── Navigation ────────────────────────────────────────────────────────────────

export { Breadcrumbs }                      from "./Breadcrumbs";
export type { BreadcrumbsProps, BreadcrumbItem } from "./Breadcrumbs";

export { Pagination }                       from "./Pagination";
export type { PaginationProps }             from "./Pagination";

// ── Forms ─────────────────────────────────────────────────────────────────────

export { FormGroup }                        from "./FormGroup";
export type { FormGroupProps }              from "./FormGroup";
