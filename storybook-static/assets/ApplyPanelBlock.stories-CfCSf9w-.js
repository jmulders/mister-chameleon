import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./block-variants-Ci_fdGtY.js";import{i as u,n as d,r as f,t as p}from"./FormSectionBlock-rHvEIQfI.js";function m(e){try{let[t,n,r]=e.split(`-`).map(Number);if(!t||!n||!r)return null;let i=new Date(t,n-1,r),a=new Date;return a.setHours(0,0,0,0),Math.ceil((i.getTime()-a.getTime())/864e5)}catch{return null}}function h({closingDate:e}){let t=m(e);if(t===null||t>14||t<0)return null;let n=t===0?`Applications close today.`:t===1?`Applications close tomorrow.`:`Applications close in ${t} days.`;return(0,y.jsxs)(`div`,{role:`alert`,style:{display:`flex`,alignItems:`center`,gap:`0.5rem`,padding:`0.75rem 1rem`,backgroundColor:`color-mix(in srgb, var(--color-error-500, #ef4444) 10%, transparent)`,border:`1px solid color-mix(in srgb, var(--color-error-500, #ef4444) 30%, transparent)`,borderRadius:`var(--card-radius)`,fontSize:`0.875rem`,fontWeight:600,color:`var(--color-error-500, #ef4444)`},children:[(0,y.jsxs)(`svg`,{width:`16`,height:`16`,viewBox:`0 0 16 16`,fill:`none`,stroke:`currentColor`,strokeWidth:`2`,strokeLinecap:`round`,"aria-hidden":`true`,children:[(0,y.jsx)(`path`,{d:`M8 1L15 13H1L8 1z`}),(0,y.jsx)(`path`,{d:`M8 6v3M8 11v.5`})]}),n]})}function g({label:e,href:t}){return(0,y.jsxs)(y.Fragment,{children:[b,(0,y.jsx)(`a`,{href:t,className:`apply-btn-primary`,style:{display:`inline-flex`,alignItems:`center`,justifyContent:`center`,padding:`0.75rem 2rem`,backgroundColor:`var(--btn-bg)`,color:`var(--btn-text)`,fontWeight:`var(--btn-font-weight)`,fontSize:`1rem`,borderRadius:`var(--btn-radius)`,boxShadow:`var(--btn-shadow)`,textDecoration:`none`,transition:`background-color var(--transition-base)`,border:`none`,cursor:`pointer`},children:e})]})}function _({label:e,href:t}){return(0,y.jsxs)(y.Fragment,{children:[b,(0,y.jsx)(`a`,{href:t,className:`apply-btn-secondary`,style:{display:`inline-flex`,alignItems:`center`,justifyContent:`center`,padding:`0.75rem 1.5rem`,backgroundColor:`transparent`,color:`var(--text)`,fontWeight:500,fontSize:`0.9375rem`,borderRadius:`var(--btn-radius)`,textDecoration:`none`,border:`1px solid var(--card-border)`,transition:`border-color var(--transition-base), color var(--transition-base)`,cursor:`pointer`},children:e})]})}function v({data:e,variant:t}){let n=c(`applyPanel`,t),i=e.heading??`Apply for this role`,o=e.body;if(e.formKey&&u(e.formKey))return(0,y.jsx)(`div`,{style:{borderTop:`1px solid var(--card-border)`},children:(0,y.jsx)(p,{data:{formKey:e.formKey,title:i,intro:o,submitLabel:`Submit application`},variant:`minimal`})});let l=(0,y.jsxs)(s,{gap:5,align:`center`,children:[(0,y.jsx)(`h2`,{style:{margin:0,fontSize:`clamp(1.375rem, 3vw, 2rem)`,fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`,color:n===`default`?`var(--section-cta-body, #fff)`:`var(--text)`,textAlign:`center`,lineHeight:1.25},children:i}),o&&(0,y.jsx)(`p`,{style:{margin:0,fontSize:`1rem`,color:n===`default`?`color-mix(in srgb, var(--section-cta-body, #fff) 80%, transparent)`:`var(--text-muted)`,lineHeight:1.6,textAlign:`center`,maxWidth:`40ch`},children:o}),e.closingDate&&(0,y.jsx)(h,{closingDate:e.closingDate}),(0,y.jsxs)(`div`,{style:{display:`flex`,flexWrap:`wrap`,gap:`0.75rem`,justifyContent:`center`},children:[e.primaryCta&&(0,y.jsx)(g,{label:e.primaryCta.label,href:e.primaryCta.href}),e.secondaryCta&&(0,y.jsx)(_,{label:e.secondaryCta.label,href:e.secondaryCta.href}),!e.primaryCta&&!e.secondaryCta&&(0,y.jsx)(`p`,{style:{fontSize:`0.875rem`,color:`var(--text-muted)`,margin:0},children:`No application link configured.`})]})]});return n===`inline`?(0,y.jsx)(a,{spacing:`md`,style:{background:`var(--bg)`},children:(0,y.jsx)(r,{size:`md`,children:(0,y.jsx)(`div`,{style:{backgroundColor:`var(--card-bg)`,border:`1px solid var(--card-border)`,borderRadius:`var(--card-radius)`,padding:`2.5rem 2rem`,textAlign:`center`},children:l})})}):(0,y.jsx)(a,{spacing:`xl`,style:{background:`var(--section-cta-bg)`,textAlign:`center`},children:(0,y.jsx)(r,{size:`md`,children:l})})}var y,b,x=e((()=>{y=t(),n(),i(),o(),l(),d(),f(),b=(0,y.jsx)(`style`,{children:`
    .apply-btn-primary:hover{background-color:var(--btn-hover-bg)}
    .apply-btn-secondary:hover{border-color:var(--text-muted);color:var(--primary)}
  `}),v.__docgenInfo={description:``,methods:[],displayName:`ApplyPanelBlock`,props:{data:{required:!0,tsType:{name:`ApplyPanelBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),S,C,w,T,E,D,O;e((()=>{x(),S={title:`Blocks/Sections/ApplyPanel`,component:v,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Primary application CTA for a vacancy detail page. Supports external ATS links (primaryCta) or an inline platform form (formKey). Shows urgency callout when deadline is within 14 days.`}}}},C={name:`default — full-width CTA section`,args:{data:{heading:`Ready to join the team?`,body:`We review every application personally and aim to respond within five business days.`,primaryCta:{label:`Apply now`,href:`#`},secondaryCta:{label:`Ask a question`,href:`#`}},variant:`default`}},w={name:`inline — card embedded mid-page`,args:{data:{heading:`Apply for this role`,body:`Send us your CV and a short note about why you are a great fit.`,primaryCta:{label:`Apply on LinkedIn`,href:`#`}},variant:`inline`}},T={name:`default — urgency callout (deadline in 3 days)`,args:{data:{heading:`Applications close soon`,body:`Do not miss your chance — submit your application before the deadline.`,primaryCta:{label:`Apply now`,href:`#`},closingDate:new Date(Date.now()+4320*60*1e3).toISOString().split(`T`)[0]},variant:`default`}},E={name:`inline — platform form (formKey: 'application')`,args:{data:{heading:`Apply now`,body:`Complete the form below. We read every submission personally.`,formKey:`application`},variant:`inline`}},D={name:`default — primary CTA only`,args:{data:{heading:`Join our team`,primaryCta:{label:`View open roles`,href:`/careers`}},variant:`default`}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "default — full-width CTA section",
  args: {
    data: {
      heading: "Ready to join the team?",
      body: "We review every application personally and aim to respond within five business days.",
      primaryCta: {
        label: "Apply now",
        href: "#"
      },
      secondaryCta: {
        label: "Ask a question",
        href: "#"
      }
    } satisfies ApplyPanelBlockData,
    variant: "default"
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "inline — card embedded mid-page",
  args: {
    data: {
      heading: "Apply for this role",
      body: "Send us your CV and a short note about why you are a great fit.",
      primaryCta: {
        label: "Apply on LinkedIn",
        href: "#"
      }
    } satisfies ApplyPanelBlockData,
    variant: "inline"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "default — urgency callout (deadline in 3 days)",
  args: {
    data: {
      heading: "Applications close soon",
      body: "Do not miss your chance — submit your application before the deadline.",
      primaryCta: {
        label: "Apply now",
        href: "#"
      },
      closingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    } satisfies ApplyPanelBlockData,
    variant: "default"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "inline — platform form (formKey: 'application')",
  args: {
    data: {
      heading: "Apply now",
      body: "Complete the form below. We read every submission personally.",
      formKey: "application"
    } satisfies ApplyPanelBlockData,
    variant: "inline"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "default — primary CTA only",
  args: {
    data: {
      heading: "Join our team",
      primaryCta: {
        label: "View open roles",
        href: "/careers"
      }
    } satisfies ApplyPanelBlockData,
    variant: "default"
  }
}`,...D.parameters?.docs?.source}}},O=[`Default`,`Inline`,`UrgentDeadline`,`WithForm`,`PrimaryOnly`]}))();export{C as Default,w as Inline,D as PrimaryOnly,T as UrgentDeadline,E as WithForm,O as __namedExportsOrder,S as default};