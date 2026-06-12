---
id: blog
blueprint: pages
site: nl
title: Blog
template: listing_page
seo_description: 'Lees de nieuwste artikelen over B2B-marketing en website personalisatie van Mister Chameleon.'
excerpt: 'Kennis en inspiratie over B2B-marketing, website personalisatie en conversie-optimalisatie.'
page_blocks:
  - id: blog-hero
    type: context_slot
    slot_type: hero
    variant_key: hero_page_banner_awareness
    is_active: true
    enabled: true
  - id: blog-intro
    type: text_section
    enabled: true
    variant: text_single
    heading: 'Kennis & inspiratie'
    body: '<p>Ontdek onze nieuwste inzichten over B2B-marketing, website personalisatie en conversie-optimalisatie. Praktische artikelen voor marketeers en growth-teams die meer willen halen uit hun website.</p>'
  - id: blog-grid
    type: collection_listing
    enabled: true
    collection: blog
    variant: listing_cards
    heading: 'Alle artikelen'
    sort_by: date
    sort_direction: desc
    limit: 12
  - id: blog-cta
    type: context_slot
    slot_type: cta
    variant_key: cta_default
    is_active: true
    enabled: true
---
