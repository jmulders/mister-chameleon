---
id: 4345716b-456d-42db-a8de-c8766c23a0c8
blueprint: pages
site: nl
title: Team
template: listing_page
seo_description: 'Maak kennis met het team achter Mister Chameleon — de mensen die B2B-websites persoonlijker en effectiever maken.'
excerpt: 'Maak kennis met het team achter Mister Chameleon.'
page_blocks:
  - id: team-hero
    type: context_slot
    slot_type: hero
    variant_key: hero_page_banner_awareness
    is_active: true
    enabled: true
  - id: team-intro
    type: text_section
    enabled: true
    variant: text_single
    heading: 'Het team achter Mister Chameleon'
    body: '<p>Een klein, gepassioneerd team dat gelooft dat iedere B2B-website relevanter en effectiever kan zijn. Wij combineren marketing-expertise met technologie om personalisatie toegankelijk te maken voor ieder bedrijf.</p>'
  - id: team-grid
    type: collection_listing
    enabled: true
    collection: team_members
    variant: listing_cards
    heading: 'Ons team'
    sort_by: sort_order
    sort_direction: asc
  - id: team-cta
    type: context_slot
    slot_type: cta
    variant_key: cta_default
    is_active: true
    enabled: true
---
