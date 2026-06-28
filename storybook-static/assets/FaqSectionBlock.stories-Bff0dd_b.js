import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./block-variants-Ci_fdGtY.js";import{n as f,t as p}from"./surface-kVxEVXL4.js";import{n as m,t as h}from"./Accordion-DefhAFOE.js";import{t as g}from"./molecules-CH9GzcJk.js";function _({data:e,variant:t,surface:n}){let i=u(`faqSection`,t),{heading:o,items:c}=e,d=c??[];if((i===`faq_default`?`default`:i===`faq_split`?`two-col`:i)===`two-col`){let e=Math.ceil(d.length/2),t=d.slice(0,e),i=d.slice(e);return(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--section-subtle-bg)`,borderTopColor:`var(--section-subtle-border)`,borderBottomColor:`var(--section-subtle-border)`},className:`border-y`,children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:10,children:[o&&(0,v.jsx)(l,{variant:`h2`,align:`center`,children:o}),d.length>0&&(0,v.jsxs)(`div`,{className:`grid gap-x-8 gap-y-2 sm:grid-cols-2`,children:[(0,v.jsx)(h,{gap:2,children:t.map((e,t)=>(0,v.jsx)(m,{title:e.question,children:(0,v.jsx)(`p`,{className:`leading-relaxed text-[var(--muted-foreground)]`,children:e.answer})},`${e.question}-${t}`))}),(0,v.jsx)(h,{gap:2,children:i.map((t,n)=>(0,v.jsx)(m,{title:t.question,children:(0,v.jsx)(`p`,{className:`leading-relaxed text-[var(--muted-foreground)]`,children:t.answer})},`${t.question}-${n+e}`))})]})]})})})}return(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--section-subtle-bg)`,borderTopColor:`var(--section-subtle-border)`,borderBottomColor:`var(--section-subtle-border)`},className:`border-y`,children:(0,v.jsx)(r,{size:`md`,children:(0,v.jsxs)(s,{gap:10,children:[o&&(0,v.jsx)(l,{variant:`h2`,align:`center`,children:o}),d.length>0&&(0,v.jsx)(h,{gap:2,children:d.map((e,t)=>(0,v.jsx)(m,{title:e.question,children:(0,v.jsx)(`p`,{className:`leading-relaxed text-[var(--muted-foreground)]`,children:e.answer})},`${e.question}-${t}`))})]})})})}var v,y=e((()=>{v=t(),n(),i(),o(),c(),g(),d(),p(),_.__docgenInfo={description:``,methods:[],displayName:`FaqSectionBlock`,props:{data:{required:!0,tsType:{name:`FaqSectionBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``},surface:{required:!1,tsType:{name:`BlockSurface`},description:``}}}})),b,x,S,C,w,T,E,D,O,k;e((()=>{y(),b={heading:`Frequently asked questions`,items:[{question:`What is included in the plan?`,answer:`All plans include unlimited access to features, priority support, and monthly usage reports. You can cancel at any time with no penalties.`},{question:`Can I cancel at any time?`,answer:`Yes — cancel from your account settings at any time. Your access continues until the end of the current billing period.`},{question:`Is there a free trial?`,answer:`We offer a 14-day free trial on all plans. No credit card required to get started.`},{question:`How does billing work?`,answer:`Billing is monthly or annual. Annual plans receive a 20% discount automatically applied at checkout.`}]},x={heading:`Everything you need to know`,items:[...b.items,{question:`Do you offer team plans?`,answer:`Yes. Team plans support up to 50 seats and include a shared dashboard, admin controls, and SSO.`},{question:`Can I export my data?`,answer:`You can export all your data as CSV or JSON at any time from the account settings panel.`},{question:`Is my data secure?`,answer:`We are SOC 2 Type II certified and GDPR compliant. Data is encrypted at rest and in transit.`},{question:`What payment methods are accepted?`,answer:`We accept Visa, Mastercard, American Express, and SEPA direct debit for European customers.`}]},S={items:b.items},C={title:`Blocks/Sections/FaqSection`,component:_,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"FAQ accordion block. Renders an optional heading followed by native `<details>`/`<summary>` accordion items. Two variants: `default` (single-column) and `two-col` (two-column grid for dense sets)."}}}},w={args:{data:b,variant:`default`}},T={name:`Two-column (dense set)`,args:{data:x,variant:`two-col`}},E={name:`No heading`,args:{data:S,variant:`default`}},D={name:`Canonical: faq_default`,args:{data:b,variant:`faq_default`}},O={name:`Canonical: faq_split`,args:{data:x,variant:`faq_split`}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    data: shortFaqs,
    variant: "default"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "Two-column (dense set)",
  args: {
    data: longFaqs,
    variant: "two-col"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: noHeading,
    variant: "default"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "Canonical: faq_default",
  args: {
    data: shortFaqs,
    variant: "faq_default"
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "Canonical: faq_split",
  args: {
    data: longFaqs,
    variant: "faq_split"
  }
}`,...O.parameters?.docs?.source}}},k=[`Default`,`TwoColumn`,`NoHeading`,`FaqDefault`,`FaqSplit`]}))();export{w as Default,D as FaqDefault,O as FaqSplit,E as NoHeading,T as TwoColumn,k as __namedExportsOrder,C as default};