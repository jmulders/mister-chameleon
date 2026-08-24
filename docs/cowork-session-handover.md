# Cowork-sessie handover — design/theme/effecten-run (aug 2026)

Dit document legt de volledige context van een grote Cowork-werkrun vast, zodat de
sessie vanaf elk apparaat (via GitHub) op te pikken is. Het chatvenster kan lokaal
op de desktop blijven; dit bestand is de draagbare bron van waarheid.

## Werkwijze / conventies (belangrijk voor wie doorpakt)

- **Rolverdeling deze run:** de gebruiker (Jasper) stuurt met korte requests +
  screenshots; een aparte "Claude Code"-builder-agent doet het werk; de Cowork-Claude
  orchestreert (schrijft paste-klare prompts, reviewt elke dev-check, geeft merge-go's).
- **Nooit tegen prod schrijven.** Dev-migraties mogen pas na hardop bevestigen dat het
  doel het **dev**-project `xqaeqbqjymeyxbvmhseg` is. Prod-SQL wordt **aangeleverd** en
  door de gebruiker zelf gedraaid. Prod-project: `kdhfpvjeriszteqhpgll`.
- **Per wijziging:** push-first -> groene CI (Verify/Build/Vercel) -> dev-check
  (visueel/before-after waar zinnig) -> stop voor merge-go -> squash-merge, auto-merge
  uit, geen force-push naar `main`.
- **Copy/taal:** admin-UI Engels, website-copy Nederlands, geen em-dashes, geen
  AI-achtige iconen/symbolen.
- **Prod-SQL deze run gedraaid:** migraties 169 + 170 (IP-hash), 171 (design_effect_sets).

## Kernarchitectuur die je moet kennen

- **Twee theme-paden:** `tenant-theme.ts` (`buildThemeVarsArray`, curated
  THEME_PRESETS) en `tenant/resolve-theme.ts` (`resolveThemeForTenant`, de
  gallery/custom-preset-route met tokenOverrides, Layer A/B). Terugkerende valkuil:
  **block-tokens (`design.defaultTokens`) worden op een specifiekere scope geemit dan
  `[data-site]`**, dus ze kunnen een theme-var-fix maskeren. Meerdere bugs deze run
  waren varianten hiervan.
- **Effecten-laag (declaratief, geen rauwe JS):** registry `design-system/effects/
  effect-defs.ts` is de single source of truth; runtime is een geversioneerde
  vanilla player (`effect-runtime.ts` + `BlockEffectRuntime`). Resolutie-tiers:
  **instance-ref -> block-type-default -> tenant-default** (`resolveBlockEffects`),
  met `disabled` als kill-switch. Beheer op drie plekken: Design -> Block styles
  (bibliotheek + tenant-default via `EffectsEditor`), `personalization/blocks`
  (per adaptief block), en Allowed Blocks/BlockCatalogue (per block-type).
- **IP-cache privacy:** `ip_company_cache` is platform-breed, gekeyd op `ip_hash`
  (HMAC-SHA256 onder `IP_HASH_KEY`, domain-separated). Geen rauwe IP's meer opgeslagen.

## Gemergede PR's deze run (op volgorde)

| PR | Onderwerp |
|----|-----------|
| #216 | IP-cache HMAC-hardening (migraties 169+170, prod-SQL gedraaid) |
| #217 | Contrast structural fix: form-familie + font-rollen herpind, outline/ghost -> `currentColor`, contrast-audit + `contrastRatio`-helper |
| #218 | Topband-fix: `--header-topband-bg` valt terug op `--header-bg` + resolve-theme-pin; search-hero losgekoppeld |
| #219 | Explorer chrome-pickers (header/footer/topband afgeleid uit palet, expliciete override) |
| #220 | Root-token propagatie-audit (`docs/design/root-token-propagation-audit.md`) |
| #221 | Card-op-donker-scheiding (Layer A + Layer B render-time lift) |
| #222 | Effecten-laag core (registry, geversioneerde runtime, entrance/emphasis) |
| #223 | Effecten advanced (parallax, sticky, Ken Burns; default-uit, feature-detected) |
| #224 | Effecten snippet-pad (`data-mc-fx-*`) |
| #225 | Effecten beheerde bibliotheek (`design_effect_sets`, migratie 171, `EffectsEditor`) |
| #226 | Theme-switching plan-doc |
| #227 | Pariteits-extensie resolve-theme fan-out (include surface/border/accent, exclude 3 inverse-surface-teksten) |
| #228 | Theme-switching runtime (contextuele gallery-preset-injectie, `mc_theme`-lock, `themeKey` backward-compat) |
| #229 | Theme-switching block-token-injectie (contextuele `defaultTokens`) |
| #230 | Theme-switching gecategoriseerde gallery-picker (per regel) |
| #231 | Theme-switching add-time gallery-selectie |
| #232 | Design-tab-consolidatie (7 -> 5: Theme/Customize/Layout/Typography/Block styles) |
| #233 | Ads inherit-host wiring |
| #234 | Explorer WCAG-contrastwaarschuwing |
| #235 | IP-cache-beheerscherm (platform-admin, read-only + Clear cache) |
| #236 | Effecten per-adaptief-block picker (`personalization/blocks`) |
| #237 | Effecten per-block-type default (Allowed Blocks) |
| #238 | Effecten op snippet `emitBlockInto`-pad |
| #239 | Pariteits-tokens gefold (`--btn-ring`, `--hero-glow-color`, proof/feature card-shadows) |
| #240 | `themeKey -> gallery`-bridge (synthetiseert `curated:<K>`, convert-flow) |

## In behandeling / open

- **#241 (URGENT, wacht op merge-go):** failsafe voor blanco homepage bij tenant-default
  entrance-effecten. Oorzaak: IntersectionObserver levert z'n eerste callback nooit bij
  `document.visibilityState === "hidden"` (background-tab-load), dus met default-effecten
  op elk blok bleef alles op `opacity:0`. Vijf safeguards: (1) above-the-fold synchroon
  revealen bij mount, (2) `visibilitychange`-reveal, (3) harde 2000ms-failsafe, (4)
  MutationObserver voor client-nav, (5) inline layout-failsafe die `mc-fx-ready` na
  2500ms weghaalt bij totale hydration-failure.
- **Mitigatie die de gebruiker deed:** default-effecten tijdelijk weggehaald (Design ->
  Block styles -> Remove + Save). Na deploy van #241 kunnen ze weer veilig terug.

## Cosmetische queue (na #241, in deze volgorde)

1. **Nieuwe effecten aan de registry:** `slide-in-down`, `blur-in`, `pop`/bounce-in,
   `flip-in`/rotate-in, `wipe-reveal` (entrance); `stagger` (kinderen in sequence);
   `pulse`, `glow-pulse` (emphasis); `scroll-fade`, `scroll-scale` (continuous,
   default-uit). Allemaal reduced-motion-veilig, declaratief, geversioneerd.
2. **Card-op-donker maskeer-gat:** `blockTokensFromOverrides` (`preset-to-block-tokens.ts`
   r84) zet `cardBg = c.card` rauw -> maskeert de #221-lift op de block-scope. Fix:
   lift in de derivatie EN render-time op het site-default block-scope-emissiepunt;
   mik iets boven ~1.35 contrast.
3. **Secondary-knop licht-op-licht:** `--btn-secondary-text` (fallback `--primary`) op
   `--btn-secondary-bg` (fallback `--muted`) wordt licht-op-licht op sommige presets
   (bijv. "Lees cases" op de amber-hero). Fix: luminantie-bewust in beide theme-paden
   (`contrastRatio` + `readableText`) + de block-token-laag, zelfde maskeer-clausule.

## Beslissingen / bewust NIET gedaan

- **Pariteits-keuze (afgerond):** aanbevolen split toegepast in #227/#239 — include
  surface/border/accent, exclude `--hero-title-color`/`--hero-subtitle-color`/
  `--section-cta-body` (blijven preset/luminantie-gestuurd).
- **`themeKey -> gallery`-bridge:** eerst overgeslagen, later toch gebouwd (#240).

## Nuttige verwijzingen

- `docs/design/root-token-propagation-audit.md` — welke `:root`-tokens op welke
  laag herpind worden.
- `CLAUDE.md` — projectconventies (git/PR-regels, prod-veiligheid, migratie-ledger
  `public._migrations`, Supabase-projecten).
- Supabase: dev `xqaeqbqjymeyxbvmhseg`, prod `kdhfpvjeriszteqhpgll`.
