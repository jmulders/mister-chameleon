import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./block-variants-Ci_fdGtY.js";import{n as f,t as p}from"./Grid-nQzDC2-U.js";import{n as m,t as h}from"./ResultCard-BDpHq5rH.js";function g(e){return{id:e.id,title:e.title,href:e.href,excerpt:e.excerpt,imageUrl:e.imageUrl,hoverImageUrl:e.hoverImageUrl,imageAlt:e.imageAlt,category:e.category,date:e.date}}function _({data:e,variant:t}){let n=u(`relatedContent`,t),i=e.maxItems?e.items.slice(0,e.maxItems):e.items;if(i.length===0)return null;let o=e.heading??`Related content`;return n===`related_slider`?(0,v.jsx)(a,{spacing:`lg`,style:{borderTop:`1px solid var(--card-border)`,background:`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:6,children:[(0,v.jsx)(l,{variant:`h2`,style:{color:`var(--text)`,fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`},children:o}),(0,v.jsx)(`div`,{className:`flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth`,style:{scrollbarWidth:`none`},children:i.map((e,t)=>(0,v.jsx)(`div`,{className:`min-w-72 flex-shrink-0 snap-start sm:min-w-80`,children:(0,v.jsx)(h,{item:g(e),layout:`card`,headingLevel:3})},e.id??String(t)))})]})})}):n===`carousel`?(0,v.jsx)(a,{spacing:`lg`,style:{borderTop:`1px solid var(--card-border)`,background:`var(--bg)`},children:(0,v.jsx)(r,{size:`xl`,children:(0,v.jsxs)(s,{gap:6,children:[(0,v.jsx)(l,{variant:`h2`,style:{color:`var(--text)`,fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`},children:o}),(0,v.jsx)(`div`,{style:{display:`grid`,gridAutoFlow:`column`,gridAutoColumns:`clamp(260px, 75vw, 320px)`,gap:`1.5rem`,overflowX:`auto`,scrollSnapType:`x mandatory`,scrollbarWidth:`none`,paddingBottom:`0.5rem`,marginInline:`calc(var(--container-padding, 1rem) * -1)`,paddingInline:`var(--container-padding, 1rem)`},children:i.map((e,t)=>(0,v.jsx)(`div`,{style:{scrollSnapAlign:`start`},children:(0,v.jsx)(h,{item:g(e),layout:`card`,headingLevel:3})},e.id??String(t)))})]})})}):n===`list`?(0,v.jsx)(a,{spacing:`lg`,style:{borderTop:`1px solid var(--card-border)`,background:`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:6,children:[(0,v.jsx)(l,{variant:`h2`,style:{color:`var(--text)`,fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`},children:o}),(0,v.jsx)(s,{gap:4,children:i.map((e,t)=>(0,v.jsx)(h,{item:g(e),layout:`row`,headingLevel:3},e.id??String(t)))})]})})}):(0,v.jsx)(a,{spacing:`lg`,style:{borderTop:`1px solid var(--card-border)`,background:`var(--bg-subtle)`},children:(0,v.jsx)(r,{size:`xl`,children:(0,v.jsxs)(s,{gap:8,children:[(0,v.jsx)(l,{variant:`h2`,style:{color:`var(--text)`,fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`},children:o}),(0,v.jsx)(p,{cols:3,gap:`lg`,children:i.map((e,t)=>(0,v.jsx)(h,{item:g(e),layout:`card`,headingLevel:3},e.id??String(t)))})]})})})}var v,y=e((()=>{v=t(),n(),i(),f(),o(),c(),d(),m(),_.__docgenInfo={description:``,methods:[],displayName:`RelatedContentBlock`,props:{data:{required:!0,tsType:{name:`RelatedContentBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),b,x,S,C,w,T,E,D,O;e((()=>{y(),b={heading:`Related articles`,items:[...[{id:`r1`,title:`Why headless architecture wins at scale`,href:`/blog/headless-architecture`,excerpt:`Monolithic CMS setups hit a ceiling. Headless architecture lets front-end and back-end teams move independently without stepping on each other.`,imageUrl:`https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=75`,imageAlt:`Server rack`,category:`Engineering`,date:`2025-02-18`},{id:`r2`,title:`Designing a content model that survives roadmap changes`,href:`/blog/content-modelling`,excerpt:`A good content model is schema-first and use-case driven. Here is how we think about content modelling for longevity.`,imageUrl:`https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=75`,imageAlt:`Whiteboard with diagrams`,category:`Design`,date:`2025-01-30`},{id:`r3`,title:`The case for progressive enhancement in 2025`,href:`/blog/progressive-enhancement`,excerpt:`JavaScript-optional experiences are back in vogue. We walk through how to layer interactivity on top of solid HTML foundations.`,imageUrl:`https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=600&q=75`,imageAlt:`Code editor`,category:`Engineering`,date:`2024-12-10`}]]},x={title:`Blocks/Sections/RelatedContent`,component:_,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Curated related content placed at the end of a detail page. Four variants: default/grid (3-col cards), list (single-column rows), carousel (horizontal scroll), related_slider (CSS-snap).`}}}},S={name:`default / grid — 3-col card grid`,args:{data:b}},C={name:`list — single-column row list`,args:{data:b,variant:`list`}},w={name:`carousel — horizontal scrolling strip`,args:{data:b,variant:`carousel`}},T={name:`related_slider — CSS-snap card carousel`,args:{data:b,variant:`related_slider`}},E={name:`maxItems — capped at 2`,args:{data:{...b,maxItems:2}}},D={name:`no heading`,args:{data:{...b,heading:void 0}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "default / grid — 3-col card grid",
  args: {
    data: base
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "list — single-column row list",
  args: {
    data: base,
    variant: "list"
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "carousel — horizontal scrolling strip",
  args: {
    data: base,
    variant: "carousel"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "related_slider — CSS-snap card carousel",
  args: {
    data: base,
    variant: "related_slider"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "maxItems — capped at 2",
  args: {
    data: {
      ...base,
      maxItems: 2
    }
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "no heading",
  args: {
    data: {
      ...base,
      heading: undefined
    }
  }
}`,...D.parameters?.docs?.source}}},O=[`Grid`,`List`,`Carousel`,`Slider`,`MaxItems`,`NoHeading`]}))();export{w as Carousel,S as Grid,C as List,E as MaxItems,D as NoHeading,T as Slider,O as __namedExportsOrder,x as default};