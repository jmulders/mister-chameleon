# Ontwerp — Context-signalen: landkaart van uitbreidingen

Status: **backlog / verkenning** (nog niet gebouwd). Opgesteld 30 aug 2026.

Wat de context nu bepaalt: **profiel** (firmografie/CRM/locatie/herkomst) + **gedrag**
(journey/engagement) + **situatie** (tijd/weer) + **pagina** (waar) + **device**, met
afgeleide segmenten/interesse/intent, known-lead-override, en de governors consent +
confidence. Hieronder de signalen die we nog **niet** hebben, met hun afwegingen.

Legenda bron: **open** = gratis/zelf te bouwen · **betaald** = externe provider (per-tenant
credential) · **eigen** = uit onze eigen tracking/CRM af te leiden.

---

## 1. Buyer-intent & diepere firmografie (grootste B2B-waarde)

| Signaal | Wat het toevoegt | Bron | Consent | B2B-waarde |
|---|---|---|---|---|
| **Third-party intent-data** (Bombora / G2 / 6sense) | "Dit account is nú in-market voor jouw categorie" — wie *koopklaar* is, niet alleen wie er is | betaald | account-niveau, geen PII van de bezoeker | ⭐⭐⭐ hoogste |
| **Technographics** (tech-stack van het bedrijf) | Segmenteren op gebruikte tools (bv. "gebruikt WordPress") | betaald | firmografisch | ⭐⭐ |
| **Groei-/hiring-signalen** (vacatures, funding) | Aanwijzing dat een account groeit/investeert | open (scrape) / betaald | firmografisch | ⭐⭐ |

## 2. CRM- & marketing-engagement-diepte (sluit aan op D8 back-office)

| Signaal | Wat het toevoegt | Bron | Consent | B2B-waarde |
|---|---|---|---|---|
| **E-mail/campagne-engagement** (opened/clicked) | Sterk retargeting-signaal; koppelt aan de back-office-koppeling (D8) | eigen/betaald (ESP) | personalisatie | ⭐⭐⭐ |
| **Diepere CRM-signalen** (open deals, deal-fase, aankopen, verlenging, churn-risico, tickets) | Personaliseren voor bestaande klanten & pipeline-accounts | eigen (CRM-API) | personalisatie | ⭐⭐⭐ |

## 3. On-page micro-gedrag (nu alleen pagina-niveau)

| Signaal | Wat het toevoegt | Bron | Consent | B2B-waarde |
|---|---|---|---|---|
| **Scroll-diepte / time-on-page / exit-intent / rage-clicks** | Real-time engagement binnen de sessie, veel scherper dan page_view-tellingen | eigen (client) | analytics/personalisatie — ruisgevoelig | ⭐⭐ |
| **Element-engagement** (welke CTA/video/FAQ) | Welk aanbod aanslaat | eigen (client) | idem | ⭐⭐ |
| **Content-affiniteit** (thema's/producten geconsumeerd) | Dieper interesse-model dan het huidige | eigen (afgeleid) | personalisatie | ⭐⭐ |

## 4. Situationeel & UX

| Signaal | Wat het toevoegt | Bron | Consent | B2B-waarde |
|---|---|---|---|---|
| **B2B-locatiebronnen** (BAG-bouwjaar, energielabel, verbruik, zonnepanelen) | Pand/energie-context per adres — **al ontworpen als D5** | open | geen PII (aggregaat/pand) | ⭐⭐ (verticaal) |
| **Verbindingskwaliteit** (Save-Data / effectivetype) | Lichtere content op trage verbinding | open (client hint) | geen | ⭐ (UX) |
| **Toegankelijkheids-voorkeuren** (reduced-motion, contrast, fontgrootte) | Adaptieve UX | open (client) | geen | ⭐ (UX) |
| **Regionale/lokale context** (regionale feestdagen, lokale events) | Fijner dan NL-breed | open | geen | ⭐ |

## 5. Identiteit

| Signaal | Wat het toevoegt | Bron | Consent | B2B-waarde |
|---|---|---|---|---|
| **Cross-device / ingelogde identiteit** | Dezelfde persoon over mobiel+desktop knopen; account/tier van de bezoeker zelf | eigen | personalisatie (persistent id) | ⭐⭐ |

---

## Rode draad / advies
- **Open-data-spoor** (locatie/pand/energie — §4, D5) = zelf te bouwen, goedkoop, geen PII.
  Laag risico, incrementeel.
- **Intent / technographics / diepere CRM** (§1, §2) = waar de echte B2B-waarde zit, maar
  vraagt **betaalde providers of per-tenant-integraties**. Grotere investering; alleen
  zinvol als een tenant het account/de credentials koppelt.
- **Micro-gedrag** (§3) = krachtig maar **consent- en ruisgevoelig** — precies waarom de
  confidence/anti-ruis-laag al bestaat; bouw dit met die gate in gedachten.

Volgorde-suggestie als je de context wilt verrijken: **§2 (CRM/e-mail-engagement, sluit op
D8)** en **§4/D5 (open locatie)** eerst — hoogste waarde/laagste drempel. **§1 (intent)** is
de strategische grote sprong voor later. **§3 (micro-gedrag)** wanneer je de anti-ruis-laag
er comfortabel op wilt loslaten.
