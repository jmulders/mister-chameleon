import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./block-variants-Ci_fdGtY.js";import{n as f,t as p}from"./surface-kVxEVXL4.js";function m({link:e}){return(0,v.jsxs)(`a`,{href:e.href,className:`group flex flex-col gap-3 rounded-xl border p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2`,style:{backgroundColor:`var(--card-bg, white)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`,boxShadow:`var(--card-shadow)`},children:[e.icon&&(0,v.jsx)(`div`,{className:`flex h-10 w-10 items-center justify-center rounded-lg text-lg`,style:{backgroundColor:`var(--section-subtle-bg)`,color:`var(--primary)`},"aria-hidden":`true`,children:e.icon}),(0,v.jsxs)(`div`,{children:[(0,v.jsx)(l,{variant:`body`,className:`font-semibold group-hover:underline`,children:e.label}),e.description&&(0,v.jsx)(l,{variant:`body-sm`,color:`muted`,className:`mt-0.5`,children:e.description})]})]})}function h({link:e}){return(0,v.jsxs)(`a`,{href:e.href,className:`group flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2`,style:{backgroundColor:`var(--card-bg, white)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`},children:[e.icon&&(0,v.jsx)(`div`,{className:`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base`,style:{backgroundColor:`var(--section-subtle-bg)`,color:`var(--primary)`},"aria-hidden":`true`,children:e.icon}),(0,v.jsxs)(`div`,{className:`flex-1 min-w-0`,children:[(0,v.jsx)(l,{variant:`body`,className:`font-medium group-hover:underline truncate`,children:e.label}),e.description&&(0,v.jsx)(l,{variant:`body-sm`,color:`muted`,className:`truncate`,children:e.description})]}),(0,v.jsx)(`svg`,{"aria-hidden":`true`,className:`h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5`,fill:`none`,stroke:`currentColor`,strokeWidth:2,viewBox:`0 0 24 24`,children:(0,v.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M9 5l7 7-7 7`})})]})}function g({link:e}){return(0,v.jsxs)(`a`,{href:e.href,className:`group flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2`,style:{backgroundColor:`var(--card-bg, white)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`},children:[e.icon&&(0,v.jsx)(`span`,{className:`shrink-0`,style:{color:`var(--primary)`},"aria-hidden":`true`,children:e.icon}),(0,v.jsx)(`span`,{className:`group-hover:underline`,children:e.label})]})}function _({data:e,variant:t,surface:n}){let i=u(`quickLinks`,t),{heading:o,description:c,links:d}=e,p=o||c?(0,v.jsxs)(s,{gap:3,children:[o&&(0,v.jsx)(l,{variant:`h2`,balance:!0,style:{fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`},children:o}),c&&(0,v.jsx)(l,{variant:`body`,color:`muted`,className:`max-w-xl`,children:c})]}):null;return i===`quicklinks_list`?(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`md`,children:(0,v.jsxs)(s,{gap:8,children:[p,(0,v.jsx)(s,{gap:3,children:d.map(e=>(0,v.jsx)(h,{link:e},e.id))})]})})}):i===`quicklinks_compact`?(0,v.jsx)(a,{spacing:`md`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:6,children:[p,(0,v.jsx)(`div`,{className:`flex flex-wrap gap-3`,children:d.map(e=>(0,v.jsx)(g,{link:e},e.id))})]})})}):(0,v.jsx)(a,{spacing:`xl`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:10,children:[p,(0,v.jsx)(`div`,{className:`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`,children:d.map(e=>(0,v.jsx)(m,{link:e},e.id))})]})})})}var v,y=e((()=>{v=t(),n(),i(),o(),c(),d(),p(),_.__docgenInfo={description:``,methods:[],displayName:`QuickLinksBlock`,props:{data:{required:!0,tsType:{name:`QuickLinksBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``},surface:{required:!1,tsType:{name:`BlockSurface`},description:``}}}})),b,x,S,C,w,T,E,D,O,k,A,j,M;e((()=>{y(),b=[{id:`1`,label:`Getting started`,href:`/docs/getting-started`,description:`Set up your first tenant in under 10 minutes.`,icon:`🚀`},{id:`2`,label:`API reference`,href:`/docs/api`,description:`Full REST & GraphQL endpoint documentation.`,icon:`📖`},{id:`3`,label:`Design tokens`,href:`/docs/tokens`,description:`Customise colours, typography, and spacing per tenant.`,icon:`🎨`},{id:`4`,label:`Multi-tenancy guide`,href:`/docs/multi-tenancy`,description:`Understand tenant isolation, routing, and data separation.`,icon:`🏢`},{id:`5`,label:`Component library`,href:`/docs/components`,description:`Browse every block and atom with live previews.`,icon:`🧩`},{id:`6`,label:`Release notes`,href:`/changelog`,description:`What's new in the latest platform release.`,icon:`📋`}],x={heading:`Explore the docs`,description:`Everything you need to build, customise, and scale your multi-tenant platform.`,links:b},S={heading:`Quick links`,links:b.map(({id:e,label:t,href:n,icon:r})=>({id:e,label:t,href:n,icon:r}))},C={heading:`Resources`,links:b.map(({id:e,label:t,href:n,description:r})=>({id:e,label:t,href:n,description:r}))},w={title:`Blocks/Sections/QuickLinks`,component:_,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Navigation hub or resource directory block. Three variants: `quicklinks_grid` (icon + label cards in a 3-col grid, default), `quicklinks_list` (single-column rows with chevrons), `quicklinks_compact` (dense flex tile strip, label only)."}}}},T={name:`quicklinks_grid (default)`,args:{data:x,variant:`quicklinks_grid`}},E={name:`quicklinks_list — single-column rows`,args:{data:x,variant:`quicklinks_list`}},D={name:`quicklinks_compact — dense tile strip`,args:{data:x,variant:`quicklinks_compact`}},O={name:`No icons`,args:{data:C,variant:`quicklinks_grid`}},k={name:`No item descriptions`,args:{data:S,variant:`quicklinks_grid`}},A={name:`No heading`,args:{data:{links:b},variant:`quicklinks_list`}},j={name:`Three links`,args:{data:{heading:`Key resources`,links:b.slice(0,3)},variant:`quicklinks_grid`}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "quicklinks_grid (default)",
  args: {
    data: baseData,
    variant: "quicklinks_grid"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "quicklinks_list — single-column rows",
  args: {
    data: baseData,
    variant: "quicklinks_list"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "quicklinks_compact — dense tile strip",
  args: {
    data: baseData,
    variant: "quicklinks_compact"
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "No icons",
  args: {
    data: noIconsData,
    variant: "quicklinks_grid"
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: "No item descriptions",
  args: {
    data: noDescriptionLinks,
    variant: "quicklinks_grid"
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: {
      links
    },
    variant: "quicklinks_list"
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  name: "Three links",
  args: {
    data: {
      heading: "Key resources",
      links: links.slice(0, 3)
    },
    variant: "quicklinks_grid"
  }
}`,...j.parameters?.docs?.source}}},M=[`Grid`,`List`,`Compact`,`NoIcons`,`NoDescriptions`,`NoHeading`,`FewLinks`]}))();export{D as Compact,j as FewLinks,T as Grid,E as List,k as NoDescriptions,A as NoHeading,O as NoIcons,M as __namedExportsOrder,w as default};