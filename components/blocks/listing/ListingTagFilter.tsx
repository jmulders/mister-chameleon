/**
 * ListingTagFilter: a row of buttons above a card grid, one per theme.
 *
 * The owner asked for it on the knowledge base on 21 Nov 2026: "filter on
 * theme, for example". All cards are rendered on the server and handed in, so
 * the page reads the same without JavaScript and for a search engine. The
 * filter only chooses which of them are shown.
 *
 * The choice lives in the address (?thema=campagnes), not in component state.
 * A filtered list can be shared and bookmarked, the back button works, and
 * the server and the browser cannot disagree about the first render: the
 * server always renders every card.
 */

"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Grid } from "@/components/primitives/Grid";
import { TAG_PARAM, tagFromParam, tagSlug } from "./listing-tags";

export interface ListingTagFilterCard {
  key:  string;
  tags: readonly string[];
  node: ReactNode;
}

interface ListingTagFilterProps {
  /** Name of the group for a screen reader, "Filter op thema". */
  label: string;
  /** Label of the button that shows everything, "Alle". */
  all:   string;
  tags:  readonly string[];
  cards: readonly ListingTagFilterCard[];
}

const CHANGE = "mc:listing-filter-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

const readParam = () => new URLSearchParams(window.location.search).get(TAG_PARAM) ?? "";
const readOnServer = () => "";

export function ListingTagFilter({ label, all, tags, cards }: ListingTagFilterProps) {
  const active = tagFromParam(tags, useSyncExternalStore(subscribe, readParam, readOnServer));

  const choose = (tag: string | null) => {
    const url = new URL(window.location.href);
    if (tag) url.searchParams.set(TAG_PARAM, tagSlug(tag));
    else url.searchParams.delete(TAG_PARAM);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(CHANGE));
  };

  const shown = active ? cards.filter((card) => card.tags.includes(active)) : cards;

  return (
    <>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        <FilterButton pressed={active === null} onClick={() => choose(null)}>{all}</FilterButton>
        {tags.map((tag) => (
          <FilterButton key={tag} pressed={active === tag} onClick={() => choose(tag)}>{tag}</FilterButton>
        ))}
      </div>

      <Grid cols={3} gap="lg">
        {shown.map((card) => (
          <div key={card.key} className="contents">{card.node}</div>
        ))}
      </Grid>
    </>
  );
}

function FilterButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        // The chosen button takes the colour of the main button of the site, the
        // others are a card with its border. One colour, as the house style asks.
        background:   pressed ? "var(--btn-bg, var(--primary))" : "var(--card-bg)",
        color:        pressed ? "var(--btn-text, var(--primary-text, #fff))" : "var(--text)",
        borderColor:  pressed ? "var(--btn-bg, var(--primary))" : "var(--card-border)",
        outlineColor: "var(--btn-ring, var(--btn-bg, var(--primary)))",
        fontFamily:   "var(--font-ui)",
      }}
    >
      {children}
    </button>
  );
}
