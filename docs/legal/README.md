# Juridische documenten — privacy

Conceptdocumenten voor de AVG-kant van het platform. **Alle documenten hier zijn
concept en geen juridisch advies.** Laat ze toetsen door een privacyjurist
voordat je ze ondertekent of aan een klant stuurt — met name de rolverdeling bij
verrijking (verwerker vs. gezamenlijke verantwoordelijkheid) en de doorgifte
buiten de EER.

| Document | Doel |
|---|---|
| `verwerkersovereenkomst.md` | DPA om mee te sturen aan tenants; met Annex I (locatie + bewaartermijn), II (subverwerkers), III (maatregelen) |
| `subverwerkers.md` | Actuele subverwerkerslijst (Annex II) |
| `grondslag-verrijking.md` | Onderbouwing grondslag + beknopte LIA + rolvraag |

**Openstaande verificaties (invullen vóór gebruik):**

- Supabase-projectregio bevestigen (EER).
- Resend-verwerkingsregio bevestigen.
- Per US-subverwerker (Vercel, MaxMind, IPinfo, Clearbit, Anthropic) de
  doorgiftegrondslag vastleggen (DPF-certificering of SCC's).
- Bedrijfsnaam/entiteit en bewaartermijn na beëindiging invullen ([ ]-velden).
- Rolverdeling verrijking juridisch laten toetsen.
