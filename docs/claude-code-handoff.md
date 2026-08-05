# Handoff naar Claude Code

Korte gids om het bouwen van "regels die context schrijven" in Claude Code op te
pakken. Claude Code leest de repo zelf; `CLAUDE.md` (repo-root) geeft de conventies.

## Eenmalig opzetten

1. Installeer Claude Code (zie code.claude.com/docs). 
2. `cd` naar deze repo.
3. Start met `claude`.
4. Optioneel: draai `/init` om een `CLAUDE.md` te laten genereren — die is er nu al,
   dus dit is alleen nodig als je 'm wilt uitbreiden.

## Kickoff-prompt (plak dit in Claude Code)

> Lees `CLAUDE.md` en daarna `docs/rule-context-writes-spec.md`.
>
> Bouw de feature "regels die context schrijven" increment voor increment volgens de
> bouwvolgorde onderaan de spec (sectie 10). Werk op een feature-branch
> (`feat/rule-context-writes` bestaat al met de spec erop; ga daarop verder).
>
> Regels:
> - Commit per increment. Draai na elke stap `npm run typecheck` en `npx eslint --quiet`
>   op de gewijzigde bestanden; los alles op voordat je verder gaat.
> - De migratie (increment 1) NIET direct op prod draaien — lever het SQL-bestand aan
>   en laat prod via de deploy lopen. Dev-project mag je wel gebruiken om te testen.
> - Push eerst, merge daarna (zie CLAUDE.md).
> - Houd de website-copy Nederlands en de demo-UI Engels.
>
> Begin met increment 1 (migratie + `rule_context` lezen/schrijven) en increment 2
> (types). Laat me na elke twee increments de diff zien voordat je doorgaat.

## Next steps (volgorde uit de spec)

1. Migratie `rule_context jsonb` op `visitor_behavior_state` + lees/schrijf in de
   JourneyState-laag. SQL aanleveren voor prod; dev om te testen.
2. Types: `RuleContextWrite`, `StoredPlan.setContext`, `FlagCondition`,
   `RuleEvaluationContext.ruleContext/entryPath/isBot`, `ExperiencePlan.setContext`.
3. Field-registry: overlay-aware resolvers + `entryPath`/`isBot`/`hasCampaignParam`
   + FlagCondition-matcher + validatie.
4. Context-builder: `entryPath` (sticky), `isBot`, overlay laden.
5. Engine: 2-fasen-evaluatie (schrijven → kiezen) + sticky-persistentie.
6. Admin-UI: FlagCondition-conditietype + "Context zetten"-sectie in de plan-editor.
7. Bot-uitsluiting in meting/scoreverdeling.
8. Tests + typecheck + eslint, dan PR.

## Meet-eerst (voordat je varianten schrijft)

Zet na increment 5 **regel 1 als tag-only** live (zet alleen
`gericht_binnengekomen`, geen variant) met een teller, en meet een paar weken
hoeveel sessies invallen. Te weinig → niet verder bouwen. Zie spec sectie 9.

## Handig om te weten

- Supabase dev `xqaeqbqjymeyxbvmhseg`, prod `kdhfpvjeriszteqhpgll`.
- Prod-tenants: `nascita`, `statamic`, `mister-chameleon`.
- Rule-fire-registratie werkt alleen als de provider een `tenantId` krijgt.
- `validateStoredConfig` verwerpt de hele config bij dubbele priority — geef regels
  distinct priorities.
