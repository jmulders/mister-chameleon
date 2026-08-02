# Subverwerkerslijst — Mister Chameleon (Annex II)

**Status: concept, te verifiëren.** Deze lijst hoort bij de
verwerkersovereenkomst (`verwerkersovereenkomst.md`). Controleer per regel de
actuele vestiging, verwerkingsregio en doorgiftegrondslag; die kunnen wijzigen.
Dit is geen juridisch advies.

Laatst bijgewerkt: 2 augustus 2026

---

## Altijd actief (kerninfrastructuur)

| Subverwerker | Functie | Persoonsgegevens | Locatie / regio | Doorgifte buiten EER |
|---|---|---|---|---|
| **Vercel Inc.** | Hosting + serverless compute | IP-adres, verzoekmetadata (transient) | VS-bedrijf; deploy in EER-regio (Frankfurt `fra1` aanbevolen) | Ja — SCC's / DPF verifiëren |
| **Supabase** | PostgreSQL-database + opslag | Bezoekersprofielen, formulierinzendingen, ABM-leads | **EER — Ierland (eu-west-1)** | Nee |
| **Resend** | Transactionele/adaptieve e-mail | Ontvanger-e-mailadres + e-mailinhoud | **Verwerkingsregio verifiëren** | Waarschijnlijk — verifiëren |
| **Anthropic** | AI-generatie van *variantcopy* | **Geen bezoeker-PII** — alleen contentprompts voor marketingtekst | VS | Ja — DPF/SCC's; scope beperkt tot copy |

> Opmerking: de AI-copygenerator (`ai/variant-generator.ts`) ontvangt geen
> bezoekersprofielen; hij schrijft marketingvarianten. Bezoekersgegevens gaan
> niet naar Anthropic.

## Alleen wanneer de tenant verrijking aanzet én de bezoeker toestemming geeft

| Subverwerker | Functie | Persoonsgegevens | Locatie | Doorgifte |
|---|---|---|---|---|
| **MaxMind** | GeoIP (IP → geo) | IP-adres → land/regio | VS | Ja — verifiëren |
| **IPinfo** | IP → ASN/organisatie/domein | IP-adres → netwerkorganisatie | VS | Ja — verifiëren |
| **Leadinfo** | IP → bedrijf | IP-adres → bedrijf | EER (NL) — verifiëren | Waarschijnlijk niet |
| **Clearbit (of alternatief)** | Firmografie | IP/domein → bedrijfskenmerken | VS | Ja — verifiëren |
| **OpenKvK** | NL-handelsregister | Bedrijfsgegevens (publiek register) | EER (NL) | Nee |
| **Nager.Date** | Feestdagen-API | **Geen persoonsgegevens** | n.v.t. | n.v.t. |

## Alleen wanneer de tenant de koppeling zelf configureert

| Subverwerker | Functie | Rol | Opmerking |
|---|---|---|---|
| **HubSpot** | CRM-synchronisatie | Verwerker **van de tenant** | De tenant is verwerkingsverantwoordelijke voor zijn eigen CRM; koppeling met tenant-token |
| **CMS (Statamic / Sanity / Storyblok)** | Content | Content, doorgaans geen bezoeker-PII | Per tenant; EER-regio waar mogelijk |

---

## Onderhoud van deze lijst

- Werk deze lijst bij vóór elke nieuwe subverwerker en informeer bestaande
  tenants vooraf (art. 5.2 DPA), zodat zij bezwaar kunnen maken.
- Bevestig per US-subverwerker de doorgiftegrondslag (EU-VS Data Privacy
  Framework-certificering of SCC's) en leg dat vast.
- Bevestig de Supabase-projectregio en de Resend-verwerkingsregio; pas de
  "buiten EER"-kolom daarop aan.
