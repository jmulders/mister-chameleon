import{n as e}from"./chunk-vNrZSFDR.js";import{M as t,a as n,c as r,i,l as a,n as o,t as s}from"./iframe-BPplKtwB.js";import{n as c,t as l}from"./FeatureGridBlock-BuRPvcL8.js";import{n as u,t as d}from"./TestimonialSectionBlock-0kcUCzcR.js";function f({presetKey:e,isCanonical:t}){let r=o(n(e)),i=`mc-preset-${e}`;return(0,m.jsxs)(`div`,{id:i,"data-theme-preset":e,style:{border:t?`2px solid var(--primary, #6366f1)`:`1px solid #e2e8f0`,borderRadius:`8px`,overflow:`hidden`,background:`white`},children:[(0,m.jsx)(`style`,{dangerouslySetInnerHTML:{__html:`#${i} { ${r} }`}}),(0,m.jsxs)(`div`,{style:{padding:`10px 16px`,background:t?`var(--primary, #6366f1)`:`#f1f5f9`,color:t?`#fff`:`#334155`,display:`flex`,alignItems:`center`,gap:`8px`,fontSize:`13px`,fontFamily:`system-ui, sans-serif`},children:[(0,m.jsx)(`span`,{style:{fontWeight:600,fontFamily:`monospace`},children:e}),t&&(0,m.jsx)(`span`,{style:{fontSize:`10px`,background:`rgba(255,255,255,0.25)`,padding:`1px 6px`,borderRadius:`999px`},children:`canonical`})]}),(0,m.jsx)(l,{data:{heading:`Why teams choose us`,features:h},variant:`feature_grid_3up`}),(0,m.jsx)(d,{data:{heading:`What customers say`,testimonials:g},variant:`testimonial_grid`})]})}function p({familyKey:e}){let t=r[e],n=t.presets;return(0,m.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`40px`,padding:`24px`},children:[(0,m.jsxs)(`div`,{children:[(0,m.jsxs)(`h1`,{style:{fontFamily:`system-ui, sans-serif`,fontSize:`20px`,fontWeight:700,marginBottom:`4px`},children:[t.name,` — Preset Comparison`]}),(0,m.jsxs)(`p`,{style:{fontFamily:`system-ui, sans-serif`,fontSize:`13px`,color:`#64748b`,margin:0},children:[t.tagline,` · `,n.length,` preset`,n.length===1?``:`s`,`. All share the same structural personality; colour and typography vary.`]})]}),n.map(e=>(0,m.jsx)(f,{presetKey:e,isCanonical:e===t.canonicalPreset},e))]})}var m,h,g,_,v,y,b,x,S,C,w,T;e((()=>{m=t(),c(),u(),a(),i(),s(),h=[{icon:`⚡`,title:`Instant performance`,description:`Pages load in under 200 ms globally — no cold starts, no cache misses.`},{icon:`🔒`,title:`Enterprise security`,description:`SOC 2 Type II certified. End-to-end encryption at rest and in transit.`},{icon:`🔌`,title:`Open integrations`,description:`Connect any tool via our API and 50+ native integrations out of the box.`}],g=[{quote:`Reduced our time-to-publish by 60%. Our editors love the flexibility.`,author:`Sophie van der Berg`,company:`Head of Digital — Nexus Media`,avatar:`https://i.pravatar.cc/150?img=47`},{quote:`The only platform that handled our multi-brand setup without custom dev.`,author:`Mark Leuven`,company:`CTO — BrandStack`,avatar:`https://i.pravatar.cc/150?img=12`},{quote:`Design tokens made brand consistency trivial across 12 tenant sites.`,author:`Priya Nair`,company:`Lead Designer — Vantage Group`,avatar:`https://i.pravatar.cc/150?img=29`}],_={title:`Theme / Preset Comparison`,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Renders the same FeatureGrid + Testimonials stack under every preset that belongs to a given theme family.  The canonical preset is highlighted with a primary-coloured border.  Use this to confirm that structural character (card style, spacing, heading font) is consistent within a family while colour and typography differ between presets.`}}}},v={name:`Corporate Professional — 4 presets`,globals:{themeFamily:`corporate-professional`,themePreset:``},render:()=>(0,m.jsx)(p,{familyKey:`corporate-professional`})},y={name:`Editorial Publishing — 3 presets`,globals:{themeFamily:`editorial-publishing`,themePreset:``},render:()=>(0,m.jsx)(p,{familyKey:`editorial-publishing`})},b={name:`Startup Growth — 7 presets`,globals:{themeFamily:`startup-growth`,themePreset:``},render:()=>(0,m.jsx)(p,{familyKey:`startup-growth`})},x={name:`SaaS Product — 2 presets`,globals:{themeFamily:`saas-product`,themePreset:``},render:()=>(0,m.jsx)(p,{familyKey:`saas-product`})},S={name:`Luxury Dark — 2 presets`,globals:{themeFamily:`luxury-dark`,themePreset:``},parameters:{backgrounds:{default:`Dark`}},render:()=>(0,m.jsx)(p,{familyKey:`luxury-dark`})},C={name:`Dark AI — 3 presets`,globals:{themeFamily:`dark-ai`,themePreset:``},parameters:{backgrounds:{default:`Dark`}},render:()=>(0,m.jsx)(p,{familyKey:`dark-ai`})},w={name:`Clean Corporate — 3 presets`,globals:{themeFamily:`clean-corporate`,themePreset:``},render:()=>(0,m.jsx)(p,{familyKey:`clean-corporate`})},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "Corporate Professional — 4 presets",
  globals: {
    themeFamily: "corporate-professional",
    themePreset: ""
  },
  render: () => <FamilyPresetComparison familyKey="corporate-professional" />
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "Editorial Publishing — 3 presets",
  globals: {
    themeFamily: "editorial-publishing",
    themePreset: ""
  },
  render: () => <FamilyPresetComparison familyKey="editorial-publishing" />
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "Startup Growth — 7 presets",
  globals: {
    themeFamily: "startup-growth",
    themePreset: ""
  },
  render: () => <FamilyPresetComparison familyKey="startup-growth" />
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "SaaS Product — 2 presets",
  globals: {
    themeFamily: "saas-product",
    themePreset: ""
  },
  render: () => <FamilyPresetComparison familyKey="saas-product" />
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "Luxury Dark — 2 presets",
  globals: {
    themeFamily: "luxury-dark",
    themePreset: ""
  },
  parameters: {
    backgrounds: {
      default: "Dark"
    }
  },
  render: () => <FamilyPresetComparison familyKey="luxury-dark" />
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "Dark AI — 3 presets",
  globals: {
    themeFamily: "dark-ai",
    themePreset: ""
  },
  parameters: {
    backgrounds: {
      default: "Dark"
    }
  },
  render: () => <FamilyPresetComparison familyKey="dark-ai" />
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "Clean Corporate — 3 presets",
  globals: {
    themeFamily: "clean-corporate",
    themePreset: ""
  },
  render: () => <FamilyPresetComparison familyKey="clean-corporate" />
}`,...w.parameters?.docs?.source}}},T=[`Corporate`,`Editorial`,`Startup`,`SaaS`,`Luxury`,`DarkAI`,`CleanCorporate`]}))();export{w as CleanCorporate,v as Corporate,C as DarkAI,y as Editorial,S as Luxury,x as SaaS,b as Startup,T as __namedExportsOrder,_ as default};