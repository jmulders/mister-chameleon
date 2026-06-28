import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./FeatureGridBlock-BuRPvcL8.js";var r,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,O,k;e((()=>{t(),r={mobile:{name:`Mobile  (375 × 812)`,styles:{width:`375px`,height:`812px`}},tablet:{name:`Tablet  (768 × 1024)`,styles:{width:`768px`,height:`1024px`}},desktop:{name:`Desktop (1280 × 900)`,styles:{width:`1280px`,height:`900px`}}},i={heading:`Why teams choose us`,features:[{icon:`⚡`,title:`Blazing fast`,description:`Built for performance from the ground up. Pages load in under 200 ms globally.`},{icon:`🔒`,title:`Enterprise-grade security`,description:`SOC 2 Type II certified. Data encrypted at rest and in transit at all times.`},{icon:`🔌`,title:`Extensible by design`,description:`Connect any tool in your stack via our open API and 50+ native integrations.`}]},a={heading:`Everything your team needs`,features:[...i.features,{icon:`📊`,title:`Powerful analytics`,description:`Real-time dashboards with drill-down reporting and CSV export.`},{icon:`🤝`,title:`Team collaboration`,description:`Comments, mentions, and shared workspaces keep everyone aligned.`},{icon:`🌍`,title:`Global CDN`,description:`Content served from 40+ edge locations worldwide.`}]},o={heading:`Feature overview`,features:[...a.features,{icon:`🔔`,title:`Smart notifications`,description:`Only get notified when it matters — fully configurable per channel.`},{icon:`🎨`,title:`White-label ready`,description:`Apply your brand colours, logo, and domain in minutes.`}]},s={heading:`Core capabilities`,features:i.features.map(({title:e,description:t})=>({title:e,description:t}))},c={title:`Blocks/Sections/FeatureGrid`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,viewport:{viewports:r},docs:{description:{component:"Feature grid block with four layout variants: `default` (3-col bordered cards on subtle bg), `cards` (elevated shadow cards on white), `compact` (2-col dense grid), `icons-left` (horizontal icon + text rows), and `feature_grid_4up` (4-col grid for larger feature sets). Mobile-first: grids collapse to 1 col at 375px."}}}},l={name:`Default (3-col bordered cards)`,args:{data:i,variant:`default`}},u={name:`Cards (elevated, on white)`,args:{data:i,variant:`cards`}},d={name:`Compact (2-col dense grid)`,args:{data:a,variant:`compact`}},f={name:`Icons left (checklist rows)`,args:{data:a,variant:`icons-left`}},p={name:`4-up grid (feature_grid_4up)`,args:{data:o,variant:`feature_grid_4up`}},m={name:`No heading`,args:{data:{features:i.features},variant:`default`}},h={name:`No icons`,args:{data:s,variant:`default`}},g={name:`Canonical: feature_grid_checklist`,args:{data:a,variant:`feature_grid_checklist`}},_={name:`Default (3-col) — mobile (375px)`,args:{data:i,variant:`default`},parameters:{viewport:{defaultViewport:`mobile`}}},v={name:`Default (3-col) — tablet (768px)`,args:{data:i,variant:`default`},parameters:{viewport:{defaultViewport:`tablet`}}},y={name:`Cards — mobile (375px)`,args:{data:i,variant:`cards`},parameters:{viewport:{defaultViewport:`mobile`}}},b={name:`Compact (2-col) — mobile (375px)`,args:{data:a,variant:`compact`},parameters:{viewport:{defaultViewport:`mobile`}}},x={name:`Icons left — mobile (375px)`,args:{data:a,variant:`icons-left`},parameters:{viewport:{defaultViewport:`mobile`}}},S={name:`4-up grid — mobile (375px)`,args:{data:o,variant:`feature_grid_4up`},parameters:{viewport:{defaultViewport:`mobile`}}},C={...i,cta:{label:`See all features`,href:`/features`,variant:`primary`}},w={...i,cta:{label:`Learn more`,href:`/about`,variant:`outline`}},T={...i,cta:{label:`View full feature list →`,href:`/features`,variant:`link`}},E={name:`With CTA — primary button`,args:{data:C,variant:`default`}},D={name:`With CTA — outline button`,args:{data:w,variant:`cards`}},O={name:`With CTA — link style`,args:{data:T,variant:`icons-left`}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "Default (3-col bordered cards)",
  args: {
    data: threeFeatures,
    variant: "default"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Cards (elevated, on white)",
  args: {
    data: threeFeatures,
    variant: "cards"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Compact (2-col dense grid)",
  args: {
    data: sixFeatures,
    variant: "compact"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Icons left (checklist rows)",
  args: {
    data: sixFeatures,
    variant: "icons-left"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "4-up grid (feature_grid_4up)",
  args: {
    data: eightFeatures,
    variant: "feature_grid_4up"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: {
      features: threeFeatures.features
    },
    variant: "default"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "No icons",
  args: {
    data: noIcons,
    variant: "default"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "Canonical: feature_grid_checklist",
  args: {
    data: sixFeatures,
    variant: "feature_grid_checklist"
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "Default (3-col) — mobile (375px)",
  args: {
    data: threeFeatures,
    variant: "default"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "Default (3-col) — tablet (768px)",
  args: {
    data: threeFeatures,
    variant: "default"
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet"
    }
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "Cards — mobile (375px)",
  args: {
    data: threeFeatures,
    variant: "cards"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "Compact (2-col) — mobile (375px)",
  args: {
    data: sixFeatures,
    variant: "compact"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "Icons left — mobile (375px)",
  args: {
    data: sixFeatures,
    variant: "icons-left"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "4-up grid — mobile (375px)",
  args: {
    data: eightFeatures,
    variant: "feature_grid_4up"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...S.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "With CTA — primary button",
  args: {
    data: withPrimaryCTA,
    variant: "default"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "With CTA — outline button",
  args: {
    data: withOutlineCTA,
    variant: "cards"
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "With CTA — link style",
  args: {
    data: withLinkCTA,
    variant: "icons-left"
  }
}`,...O.parameters?.docs?.source}}},k=[`Default`,`Cards`,`Compact`,`IconsLeft`,`FourUp`,`NoHeading`,`NoIcons`,`CanonicalChecklist`,`DefaultMobile`,`DefaultTablet`,`CardsMobile`,`CompactMobile`,`IconsLeftMobile`,`FourUpMobile`,`WithCTAPrimary`,`WithCTAOutline`,`WithCTALink`]}))();export{g as CanonicalChecklist,u as Cards,y as CardsMobile,d as Compact,b as CompactMobile,l as Default,_ as DefaultMobile,v as DefaultTablet,p as FourUp,S as FourUpMobile,f as IconsLeft,x as IconsLeftMobile,m as NoHeading,h as NoIcons,O as WithCTALink,D as WithCTAOutline,E as WithCTAPrimary,k as __namedExportsOrder,c as default};