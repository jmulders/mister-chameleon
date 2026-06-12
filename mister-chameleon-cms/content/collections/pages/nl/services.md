---
site: nl
id: 3bb3ae71-088d-4db6-b7f8-72e469a6b549
blueprint: pages
title: Services
template: default
page_blocks:
  - id: ctx_hero
    type: context_slot
    slot_type: hero
    variant_key: hero_default
    is_active: true
  - id: ctx_cta
    type: context_slot
    slot_type: cta
    variant_key: cta_default
    is_active: true
  -
    type: feature_grid
    enabled: true
    variant: feature_grid_3up
    heading: 'Waarom kiezen voor ons'
    subtitle: 'De voordelen die het verschil maken'
    items:
      - icon: Zap
        title: 'Snel van start'
        body: 'Live in één middag — geen lange implementaties.'
      - icon: Shield
        title: Privacy-vriendelijk
        body: 'Geen cookies, geen toestemming nodig.'
      - icon: TrendingUp
        title: 'Meetbare resultaten'
        body: 'Gemiddeld 3× hogere conversie.'
      - icon: Settings
        title: 'Eenvoudig beheer'
        body: 'Content beheren in uw vertrouwde CMS.'
      - icon: Users
        title: 'Persoonlijke aanpak'
        body: 'Elke bezoeker krijgt de meest relevante boodschap.'
      - icon: BarChart2
        title: 'Inzicht & rapportage'
        body: 'Realtime inzicht in prestaties per segment.'
  - type: text_section
    enabled: true
    variant: text_lead
    heading: 'Alles wat u nodig heeft'
    body: '<p>Ontdek waarom honderden bedrijven kiezen voor onze oplossing. Wij maken personalisatie eenvoudig, effectief en volledig GDPR-vriendelijk.</p>'
---
