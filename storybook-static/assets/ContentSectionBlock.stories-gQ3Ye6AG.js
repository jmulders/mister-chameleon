import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./block-variants-Ci_fdGtY.js";import{n as f,t as p}from"./PortableTextRenderer-CfV_W9A9.js";function m({ctas:e,align:t}){let n=(e??[]).slice(0,2);return n.length===0?null:(0,g.jsx)(`div`,{className:`flex flex-wrap items-center gap-3 ${t===`center`?`justify-center`:`justify-start`}`,children:n.map((e,t)=>{let n=(e.variant??(t===0?`primary`:`secondary`))===`primary`;return(0,g.jsx)(`a`,{href:e.href,className:`inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90`,style:n?{background:`var(--btn-bg)`,color:`var(--btn-text)`}:{background:`var(--bg-subtle)`,color:`var(--text)`},children:e.label},e.href)})})}function h({data:e,variant:t}){let n=u(`contentSection`,t),{eyebrow:i,heading:o,intro:c,body:d,ctas:f,maxWidth:h=`default`,align:_=`left`}=e;if(n===`content_split`)return(0,g.jsx)(a,{spacing:`lg`,children:(0,g.jsx)(r,{size:`lg`,children:(0,g.jsxs)(`div`,{className:`flex flex-col gap-10 lg:flex-row lg:gap-16`,children:[(0,g.jsx)(`div`,{className:`lg:w-2/5 xl:w-1/3`,children:(0,g.jsxs)(s,{gap:4,children:[i&&(0,g.jsx)(l,{variant:`body-sm`,weight:`semibold`,className:`uppercase tracking-wide`,style:{color:`var(--text-brand)`},children:i}),o&&(0,g.jsx)(l,{variant:`h2`,style:{fontFamily:`var(--font-heading)`},children:o})]})}),(0,g.jsx)(`div`,{className:`flex-1`,children:(0,g.jsxs)(s,{gap:6,children:[c&&(0,g.jsx)(l,{variant:`body`,className:`text-lg`,color:`muted`,children:c}),d&&d.length>0&&(0,g.jsx)(p,{blocks:d}),(0,g.jsx)(m,{ctas:f,align:`left`})]})})]})})});let v=h===`narrow`?`sm`:h===`wide`?`lg`:`md`,y=_===`center`?`center`:`left`;return(0,g.jsx)(a,{spacing:`lg`,children:(0,g.jsx)(r,{size:v,children:(0,g.jsxs)(s,{gap:6,children:[i&&(0,g.jsx)(l,{variant:`body-sm`,weight:`semibold`,className:`uppercase tracking-wide`,align:y,style:{color:`var(--text-brand)`},children:i}),o&&(0,g.jsx)(l,{variant:`h2`,align:y,style:{fontFamily:`var(--font-heading)`},children:o}),c&&(0,g.jsx)(l,{variant:`body`,className:`text-lg`,color:`muted`,align:y,children:c}),d&&d.length>0&&(0,g.jsx)(p,{blocks:d}),(0,g.jsx)(m,{ctas:f,align:_})]})})})}var g,_=e((()=>{g=t(),n(),i(),o(),c(),f(),d(),h.__docgenInfo={description:``,methods:[],displayName:`ContentSectionBlock`,props:{data:{required:!0,tsType:{name:`ContentSectionBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),v,y,b,x,S,C,w;e((()=>{_(),v={eyebrow:`Our process`,heading:`From idea to shipped product in eight weeks`,intro:`A sprint-based delivery model that keeps stakeholders aligned and reduces the risk of building the wrong thing.`,body:[{_type:`block`,_key:`c1`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s1`,text:`We believe great software starts with clear thinking. Our process combines structured discovery workshops with rapid prototyping so you can validate assumptions before writing a single line of production code.`,marks:[]}]},{_type:`block`,_key:`c2`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s2`,text:`Every engagement begins with a two-day kickoff where we map your users, constraints, and success metrics. From there we move into weekly shipping cycles with demos every Friday.`,marks:[]}]}],ctas:[{label:`See how it works`,href:`#`,variant:`primary`},{label:`View case studies`,href:`#`,variant:`secondary`}]},y={title:`Blocks/Sections/ContentSection`,component:h,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Flexible editorial section: eyebrow + heading + intro + Portable Text body + 0–2 CTAs. Two variants: content_default (single column) and content_split (heading left, body right).`}}}},b={name:`content_default — single left-aligned column`,args:{data:v,variant:`content_default`}},x={name:`content_split — eyebrow/heading left, body right`,args:{data:v,variant:`content_split`}},S={name:`no CTAs`,args:{data:{...v,ctas:[]},variant:`content_default`}},C={name:`intro only — no body or CTAs`,args:{data:{eyebrow:`Quick note`,heading:`We are currently in private beta`,intro:`Join the waitlist and we will let you know as soon as we open the doors.`},variant:`content_default`}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "content_default — single left-aligned column",
  args: {
    data: base,
    variant: "content_default"
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "content_split — eyebrow/heading left, body right",
  args: {
    data: base,
    variant: "content_split"
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "no CTAs",
  args: {
    data: {
      ...base,
      ctas: []
    },
    variant: "content_default"
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "intro only — no body or CTAs",
  args: {
    data: {
      eyebrow: "Quick note",
      heading: "We are currently in private beta",
      intro: "Join the waitlist and we will let you know as soon as we open the doors."
    },
    variant: "content_default"
  }
}`,...C.parameters?.docs?.source}}},w=[`Default`,`Split`,`NoCTAs`,`IntroOnly`]}))();export{b as Default,C as IntroOnly,S as NoCTAs,x as Split,w as __namedExportsOrder,y as default};