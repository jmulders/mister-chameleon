---
site: nl
id: 73ffe2e7-8a0a-486e-9754-296f160f9f31
blueprint: pages
title: Content
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
  - type: text_section
    enabled: true
    variant: text_lead
    heading: 'Alles wat u nodig heeft'
    body: '<p>Ontdek waarom honderden bedrijven kiezen voor onze oplossing. Wij maken personalisatie eenvoudig, effectief en volledig GDPR-vriendelijk.</p>'
  - type: image
    enabled: true
    variant: text_media_right
    heading: 'Gebouwd voor groei'
    body: 'Onze oplossing past zich aan elke bezoeker aan, op basis van wie ze zijn en waarom ze komen. Geen handmatige segmentatie, geen complexe regels — gewoon relevante content op het juiste moment.'
    ctas:
      - label: 'Meer over ons'
        href: /about
  - type: image
    enabled: true
    variant: text_media_left
    heading: 'Gebouwd voor groei'
    body: 'Onze oplossing past zich aan elke bezoeker aan, op basis van wie ze zijn en waarom ze komen. Geen handmatige segmentatie, geen complexe regels — gewoon relevante content op het juiste moment.'
    ctas:
      - label: 'Meer over ons'
        href: /about
  -
    type: stats
    enabled: true
    variant: compact
    items:
      - value: 250+
        label: 'tevreden klanten'
      - value: 3×
        label: 'hogere conversie'
      - value: '< 1 dag'
        label: implementatietijd
      - value: 100%
        label: GDPR-compliant
  -
    type: testimonial_section
    enabled: true
    variant: testimonial_highlight
    heading: 'Wat onze klanten zeggen'
    items:
      - quote: 'Eindelijk personalisatie die écht werkt. Onze conversie is in een week verdubbeld.'
        author: 'Marie van den Berg'
        role: 'Marketing Manager'
        company: 'Voorbeeld B.V.'
      - quote: 'De implementatie was verrassend eenvoudig. Binnen een dag de eerste resultaten.'
        author: 'Thomas Jansen'
        role: CTO
        company: 'Tech Startup'
      - quote: 'We zien nu precies wat werkt voor welke bezoeker. Onmisbaar geworden.'
        author: 'Lisa de Vries'
        role: 'Growth Lead'
        company: Scale-up
  -
    type: cta_section
    enabled: true
    variant: cta_card
    heading: 'Klaar om te starten?'
    body: 'Sluit u aan bij honderden bedrijven die al personaliseren.'
    primary_cta:
      label: 'Gratis proberen'
      href: /contact
    secondary_cta:
      label: 'Demo aanvragen'
      href: /contact
---
