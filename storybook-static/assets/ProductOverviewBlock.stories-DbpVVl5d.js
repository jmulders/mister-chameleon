import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./Button-CxkYI-eU.js";import{n as f,t as p}from"./Grid-nQzDC2-U.js";function m({cta:e}){return e.variant===`link`?(0,y.jsx)(`div`,{className:`flex justify-center pt-2`,children:(0,y.jsx)(`a`,{href:e.href,className:`text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70`,style:{color:`var(--text-brand)`},children:e.label})}):(0,y.jsx)(`div`,{className:`flex justify-center pt-2`,children:(0,y.jsx)(d,{as:`a`,href:e.href,variant:e.variant??`primary`,size:`lg`,children:e.label})})}function h({label:e}){return(0,y.jsx)(`span`,{className:`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold`,style:{backgroundColor:`var(--bg-subtle)`,color:`var(--text-muted)`},children:e})}function g({product:e,showPrice:t,elevated:n}){return(0,y.jsxs)(s,{gap:4,className:`border p-5 sm:p-6 h-full`,style:{backgroundColor:`var(--card-bg)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`,boxShadow:n?`var(--feature-grid-card-shadow)`:void 0},children:[e.imageUrl&&(0,y.jsx)(`div`,{className:`overflow-hidden rounded-md`,style:{borderRadius:`var(--card-radius)`},children:(0,y.jsx)(`img`,{src:e.imageUrl,alt:e.imageAlt??e.title,className:`w-full h-40 object-cover`})}),(0,y.jsxs)(`div`,{className:`space-y-1.5`,children:[e.badge&&(0,y.jsx)(h,{label:e.badge}),(0,y.jsx)(l,{variant:`h4`,style:{fontWeight:`var(--font-subheading-weight)`},children:e.title})]}),(0,y.jsx)(l,{variant:`body-sm`,color:`muted`,className:`flex-1`,children:e.description}),t&&e.price&&(0,y.jsx)(`p`,{className:`text-lg font-bold tabular-nums`,style:{color:`var(--text)`},children:e.price}),e.cta&&(0,y.jsx)(`div`,{children:e.cta.variant===`link`?(0,y.jsx)(`a`,{href:e.cta.href,className:`text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70`,style:{color:`var(--text-brand)`},children:e.cta.label}):(0,y.jsx)(d,{as:`a`,href:e.cta.href,variant:e.cta.variant??`primary`,size:`md`,className:`w-full`,children:e.cta.label})})]})}function _({product:e,showPrice:t}){return(0,y.jsxs)(`div`,{className:`flex items-start gap-4 p-4 border rounded-lg`,style:{backgroundColor:`var(--card-bg)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`},children:[e.imageUrl&&(0,y.jsx)(`img`,{src:e.imageUrl,alt:e.imageAlt??e.title,className:`w-20 h-20 object-cover rounded-md shrink-0`,style:{borderRadius:`var(--card-radius)`}}),(0,y.jsxs)(`div`,{className:`flex-1 min-w-0`,children:[(0,y.jsxs)(`div`,{className:`flex items-start justify-between gap-3`,children:[(0,y.jsxs)(`div`,{className:`space-y-0.5`,children:[e.badge&&(0,y.jsx)(h,{label:e.badge}),(0,y.jsx)(l,{variant:`h4`,style:{fontWeight:`var(--font-subheading-weight)`},children:e.title}),(0,y.jsx)(l,{variant:`body-sm`,color:`muted`,children:e.description})]}),t&&e.price&&(0,y.jsx)(`p`,{className:`text-base font-bold tabular-nums shrink-0`,style:{color:`var(--text)`},children:e.price})]}),e.cta&&(0,y.jsx)(`div`,{className:`mt-3`,children:(0,y.jsx)(d,{as:`a`,href:e.cta.href,variant:e.cta.variant===`link`?`ghost`:e.cta.variant??`primary`,size:`sm`,children:e.cta.label})})]})]})}function v({data:e,variant:t}){let{heading:n,intro:i,products:o,showPrices:c=!0,cta:u}=e,d=o??[],f=t??`product_grid`;return f===`product_list`?(0,y.jsx)(a,{spacing:`lg`,children:(0,y.jsx)(r,{size:`lg`,children:(0,y.jsxs)(s,{gap:10,children:[(n||i)&&(0,y.jsxs)(s,{gap:3,children:[n&&(0,y.jsx)(l,{variant:`h2`,align:`center`,children:n}),i&&(0,y.jsx)(l,{variant:`body`,color:`muted`,align:`center`,children:i})]}),d.length>0&&(0,y.jsx)(s,{gap:3,children:d.map(e=>(0,y.jsx)(_,{product:e,showPrice:c},e.title))}),u&&(0,y.jsx)(m,{cta:u})]})})}):f===`product_cards`?(0,y.jsx)(a,{spacing:`lg`,children:(0,y.jsx)(r,{size:`lg`,children:(0,y.jsxs)(s,{gap:12,children:[(n||i)&&(0,y.jsxs)(s,{gap:3,children:[n&&(0,y.jsx)(l,{variant:`h2`,align:`center`,children:n}),i&&(0,y.jsx)(l,{variant:`body`,color:`muted`,align:`center`,children:i})]}),d.length>0&&(0,y.jsx)(p,{cols:3,gap:`lg`,children:d.map(e=>(0,y.jsx)(g,{product:e,showPrice:c,elevated:!0},e.title))}),u&&(0,y.jsx)(m,{cta:u})]})})}):(0,y.jsx)(a,{spacing:`lg`,style:{background:`var(--feature-grid-bg)`,borderTopColor:`var(--feature-grid-border)`,borderBottomColor:`var(--feature-grid-border)`},className:`border-y`,children:(0,y.jsx)(r,{size:`lg`,children:(0,y.jsxs)(s,{gap:12,children:[(n||i)&&(0,y.jsxs)(s,{gap:3,children:[n&&(0,y.jsx)(l,{variant:`h2`,align:`center`,children:n}),i&&(0,y.jsx)(l,{variant:`body`,color:`muted`,align:`center`,children:i})]}),d.length>0&&(0,y.jsx)(p,{cols:3,gap:`lg`,children:d.map(e=>(0,y.jsx)(g,{product:e,showPrice:c},e.title))}),u&&(0,y.jsx)(m,{cta:u})]})})})}var y,b=e((()=>{y=t(),n(),i(),f(),o(),c(),u(),v.__docgenInfo={description:``,methods:[],displayName:`ProductOverviewBlock`,props:{data:{required:!0,tsType:{name:`ProductOverviewBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),x,S,C,w,T,E,D,O,k,A;e((()=>{b(),x=[{title:`Adaptive Starter Kit`,description:`Everything you need to launch a fast, adaptive marketing site in a day.`,price:`€0`,badge:`Free`,cta:{label:`Get started`,href:`#`,variant:`primary`}},{title:`Growth Engine`,description:`Full A/B experimentation, advanced analytics, and AI decision support.`,price:`€49 / mo`,badge:`Most popular`,cta:{label:`Start trial`,href:`#`,variant:`primary`}},{title:`Enterprise Suite`,description:`Dedicated SLA, SSO, custom contracts, and onboarding support.`,price:`Custom`,cta:{label:`Talk to sales`,href:`#`,variant:`outline`}}],S={heading:`Our products`,intro:`Choose the plan that fits your team and budget.`,products:x,showPrices:!0},C={title:`Blocks/Sections/ProductOverview`,component:v,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Product overview section. Three variants: product_grid (3-col bordered grid), product_cards (elevated shadow cards), product_list (horizontal rows).`}}}},w={name:`product_grid — 3-col bordered grid (default)`,args:{data:S,variant:`product_grid`}},T={name:`product_cards — elevated shadow cards`,args:{data:S,variant:`product_cards`}},E={name:`product_list — horizontal list rows`,args:{data:S,variant:`product_list`}},D={name:`product_grid — with section-level CTA`,args:{data:{...S,cta:{label:`View all products`,href:`/products`,variant:`outline`}},variant:`product_grid`}},O={name:`product_grid — prices hidden`,args:{data:{...S,showPrices:!1},variant:`product_grid`}},k={name:`product_grid — heading / intro omitted`,args:{data:{products:x},variant:`product_grid`}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "product_grid — 3-col bordered grid (default)",
  args: {
    data: base,
    variant: "product_grid"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "product_cards — elevated shadow cards",
  args: {
    data: base,
    variant: "product_cards"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "product_list — horizontal list rows",
  args: {
    data: base,
    variant: "product_list"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "product_grid — with section-level CTA",
  args: {
    data: {
      ...base,
      cta: {
        label: "View all products",
        href: "/products",
        variant: "outline"
      }
    },
    variant: "product_grid"
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "product_grid — prices hidden",
  args: {
    data: {
      ...base,
      showPrices: false
    },
    variant: "product_grid"
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: "product_grid — heading / intro omitted",
  args: {
    data: {
      products
    },
    variant: "product_grid"
  }
}`,...k.parameters?.docs?.source}}},A=[`Grid`,`Cards`,`List`,`WithSectionCTA`,`NoPrices`,`MinimalData`]}))();export{T as Cards,w as Grid,E as List,k as MinimalData,O as NoPrices,D as WithSectionCTA,A as __namedExportsOrder,C as default};