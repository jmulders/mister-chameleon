---
id: vacancies
blueprint: pages
site: nl
title: Vacatures
template: listing_page
seo_description: 'Bekijk openstaande vacatures bij Mister Chameleon en kom werken aan de toekomst van B2B-marketing.'
excerpt: 'Kom werken bij Mister Chameleon en help B2B-bedrijven groeien met slimme website personalisatie.'
page_blocks:
  - id: vacancies-hero
    type: context_slot
    slot_type: hero
    variant_key: hero_page_banner_awareness
    is_active: true
    enabled: true
  - id: vacancies-intro
    type: text_section
    enabled: true
    variant: text_single
    heading: 'Werk mee aan de toekomst van B2B-marketing'
    body: '<p>Wij zoeken getalenteerde mensen die samen met ons B2B-websites slimmer, persoonlijker en effectiever maken. Een klein team, grote impact — en de vrijheid om te bouwen wat er echt toe doet.</p>'
  - id: vacancies-grid
    type: collection_listing
    enabled: true
    collection: vacancies
    variant: listing_cards
    heading: 'Openstaande vacatures'
    sort_by: date
    sort_direction: desc
    limit: 12
  - id: vacancies-cta
    type: context_slot
    slot_type: cta
    variant_key: cta_default
    is_active: true
    enabled: true
---
