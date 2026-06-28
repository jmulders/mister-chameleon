import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./Button-CxkYI-eU.js";import{n as f,t as p}from"./Grid-nQzDC2-U.js";function m({label:e}){return(0,b.jsx)(`span`,{className:`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold`,style:{backgroundColor:`var(--bg-subtle)`,color:`var(--text-muted)`},children:e})}function h({images:e,title:t}){let[n,...r]=e;return n?(0,b.jsxs)(s,{gap:3,children:[(0,b.jsx)(`div`,{className:`overflow-hidden rounded-xl aspect-square`,style:{borderRadius:`var(--card-radius)`},children:(0,b.jsx)(`img`,{src:n.url,alt:n.alt||t,className:`w-full h-full object-cover`})}),r.length>0&&(0,b.jsx)(`div`,{className:`flex gap-2 overflow-x-auto pb-1`,children:r.slice(0,5).map((e,n)=>(0,b.jsx)(`div`,{className:`shrink-0 w-16 h-16 overflow-hidden rounded-md border`,style:{borderRadius:`var(--card-radius)`,borderColor:`var(--card-border)`},children:(0,b.jsx)(`img`,{src:e.url,alt:e.alt||`${t} image ${n+2}`,className:`w-full h-full object-cover`})},n))})]}):(0,b.jsx)(`div`,{className:`flex items-center justify-center rounded-xl aspect-square`,style:{background:`var(--bg-subtle)`,borderRadius:`var(--card-radius)`,border:`1px solid var(--border)`},"aria-label":`${t} product image placeholder`,children:(0,b.jsx)(`span`,{className:`text-5xl opacity-30`,"aria-hidden":`true`,children:`🖼`})})}function g({specs:e}){return(0,b.jsx)(`div`,{className:`rounded-lg border overflow-hidden`,style:{borderColor:`var(--card-border)`},children:(0,b.jsx)(`table`,{className:`w-full text-sm`,children:(0,b.jsx)(`tbody`,{children:e.map(({label:e,value:t},n)=>(0,b.jsxs)(`tr`,{className:`border-b last:border-0`,style:{borderColor:`var(--card-border)`},children:[(0,b.jsx)(`td`,{className:`px-4 py-2.5 font-medium w-2/5`,style:{color:`var(--text-muted)`},children:e}),(0,b.jsx)(`td`,{className:`px-4 py-2.5`,style:{color:`var(--text)`},children:t})]},n))})})})}function _({product:e}){return(0,b.jsxs)(s,{gap:3,className:`border p-4`,style:{backgroundColor:`var(--card-bg)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`},children:[e.badge&&(0,b.jsx)(m,{label:e.badge}),(0,b.jsx)(l,{variant:`h4`,style:{fontWeight:`var(--font-subheading-weight)`},children:e.title}),(0,b.jsx)(l,{variant:`body-sm`,color:`muted`,children:e.description}),e.price&&(0,b.jsx)(`p`,{className:`text-base font-bold tabular-nums`,style:{color:`var(--text)`},children:e.price}),e.cta&&(0,b.jsx)(d,{as:`a`,href:e.cta.href,variant:e.cta.variant===`link`?`ghost`:e.cta.variant??`secondary`,size:`sm`,children:e.cta.label})]})}function v({data:e}){let{title:t,description:n,price:r,badge:i,specs:a,cta:o,secondaryCta:c}=e;return(0,b.jsxs)(s,{gap:6,children:[(0,b.jsxs)(s,{gap:2,children:[i&&(0,b.jsx)(m,{label:i}),(0,b.jsx)(l,{variant:`h2`,children:t})]}),r&&(0,b.jsx)(`p`,{className:`text-2xl font-bold tabular-nums`,style:{color:`var(--text)`},children:r}),n&&(0,b.jsx)(l,{variant:`body`,color:`muted`,className:`leading-relaxed`,children:n}),(o||c)&&(0,b.jsxs)(`div`,{className:`flex flex-wrap gap-3`,children:[o&&(0,b.jsx)(d,{as:`a`,href:o.href,variant:o.variant??`primary`,size:`lg`,children:o.label}),c&&(0,b.jsx)(d,{as:`a`,href:c.href,variant:c.variant??`outline`,size:`lg`,children:c.label})]}),a&&a.length>0&&(0,b.jsxs)(s,{gap:3,children:[(0,b.jsx)(l,{variant:`body-sm`,className:`uppercase tracking-wider font-semibold`,color:`muted`,children:`Specifications`}),(0,b.jsx)(g,{specs:a})]})]})}function y({data:e,variant:t}){let{relatedProducts:n}=e,i=t??`product_detail_default`,o=e.gallery??[];return i===`product_detail_full`?(0,b.jsx)(a,{spacing:`lg`,children:(0,b.jsx)(r,{size:`md`,children:(0,b.jsxs)(s,{gap:12,children:[o.length>0&&(0,b.jsx)(`div`,{className:`max-w-lg mx-auto w-full`,children:(0,b.jsx)(h,{images:o,title:e.title})}),(0,b.jsx)(v,{data:e}),n&&n.length>0&&(0,b.jsxs)(s,{gap:6,children:[(0,b.jsx)(l,{variant:`h3`,children:`Related Products`}),(0,b.jsx)(p,{cols:3,gap:`md`,children:n.map(e=>(0,b.jsx)(_,{product:e},e.title))})]})]})})}):(0,b.jsx)(a,{spacing:`lg`,children:(0,b.jsx)(r,{size:`lg`,children:(0,b.jsxs)(s,{gap:14,children:[(0,b.jsxs)(`div`,{className:`grid grid-cols-1 gap-10 lg:grid-cols-2`,children:[(0,b.jsx)(h,{images:o,title:e.title}),(0,b.jsx)(v,{data:e})]}),n&&n.length>0&&(0,b.jsxs)(s,{gap:6,children:[(0,b.jsx)(l,{variant:`h3`,children:`Related Products`}),(0,b.jsx)(p,{cols:3,gap:`md`,children:n.map(e=>(0,b.jsx)(_,{product:e},e.title))})]})]})})})}var b,x=e((()=>{b=t(),n(),i(),o(),c(),f(),u(),y.__docgenInfo={description:``,methods:[],displayName:`ProductDetailBlock`,props:{data:{required:!0,tsType:{name:`ProductDetailBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),S,C,w,T,E,D,O,k,A;e((()=>{x(),S={title:`Growth Engine`,description:`The Growth Engine bundles full A/B experimentation, adaptive hero variants, advanced analytics dashboards, and AI-assisted decision support into one cohesive platform tier. Perfect for teams that are scaling fast and need data-driven confidence at every step.`,price:`€49 / month`,badge:`Most popular`,gallery:[{url:`https://placehold.co/800x500/e2e8f0/94a3b8?text=Product+Image+1`,alt:`Product screenshot — dashboard`},{url:`https://placehold.co/800x500/dbeafe/93c5fd?text=Product+Image+2`,alt:`Product screenshot — experiments`},{url:`https://placehold.co/800x500/dcfce7/86efac?text=Product+Image+3`,alt:`Product screenshot — analytics`}],specs:[{label:`Workspaces`,value:`Up to 5`},{label:`Team members`,value:`Unlimited`},{label:`Storage`,value:`50 GB`},{label:`Support`,value:`Priority email + chat`},{label:`Custom domains`,value:`Yes`},{label:`SLA`,value:`99.9 % uptime`}],cta:{label:`Start free trial`,href:`#`,variant:`primary`},secondaryCta:{label:`View pricing`,href:`#`,variant:`outline`},relatedProducts:[{title:`Adaptive Starter Kit`,description:`Launch a fast, adaptive marketing site for free.`,price:`€0`,badge:`Free`,cta:{label:`Get started`,href:`#`,variant:`primary`}},{title:`Enterprise Suite`,description:`Dedicated SLA, SSO, and custom contracts.`,price:`Custom`,cta:{label:`Talk to sales`,href:`#`,variant:`outline`}}]},C={title:`Blocks/Sections/ProductDetail`,component:y,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Product detail section. Two variants: product_detail_default (2-col gallery + copy), product_detail_full (stacked full-width).`}}}},w={name:`product_detail_default — 2-col gallery + copy`,args:{data:S,variant:`product_detail_default`}},T={name:`product_detail_full — stacked full-width`,args:{data:S,variant:`product_detail_full`}},E={name:`product_detail_default — no gallery (placeholder shown)`,args:{data:{...S,gallery:void 0},variant:`product_detail_default`}},D={name:`product_detail_default — no specs table`,args:{data:{...S,specs:void 0},variant:`product_detail_default`}},O={name:`product_detail_default — no related products`,args:{data:{...S,relatedProducts:void 0},variant:`product_detail_default`}},k={name:`product_detail_default — minimal (title + CTA only)`,args:{data:{title:`Growth Engine`,cta:{label:`Start free trial`,href:`#`,variant:`primary`}},variant:`product_detail_default`}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "product_detail_default — 2-col gallery + copy",
  args: {
    data: base,
    variant: "product_detail_default"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "product_detail_full — stacked full-width",
  args: {
    data: base,
    variant: "product_detail_full"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "product_detail_default — no gallery (placeholder shown)",
  args: {
    data: {
      ...base,
      gallery: undefined
    },
    variant: "product_detail_default"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "product_detail_default — no specs table",
  args: {
    data: {
      ...base,
      specs: undefined
    },
    variant: "product_detail_default"
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "product_detail_default — no related products",
  args: {
    data: {
      ...base,
      relatedProducts: undefined
    },
    variant: "product_detail_default"
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: "product_detail_default — minimal (title + CTA only)",
  args: {
    data: {
      title: "Growth Engine",
      cta: {
        label: "Start free trial",
        href: "#",
        variant: "primary"
      }
    },
    variant: "product_detail_default"
  }
}`,...k.parameters?.docs?.source}}},A=[`Default`,`Full`,`NoGallery`,`NoSpecs`,`NoRelated`,`MinimalData`]}))();export{w as Default,T as Full,k as MinimalData,E as NoGallery,O as NoRelated,D as NoSpecs,A as __namedExportsOrder,C as default};