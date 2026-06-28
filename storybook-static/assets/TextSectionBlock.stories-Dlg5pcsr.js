import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./block-variants-Ci_fdGtY.js";import{n as f,t as p}from"./surface-kVxEVXL4.js";import{n as m,t as h}from"./PortableTextRenderer-CfV_W9A9.js";function g({data:e,variant:t,surface:n}){let i=u(`textSection`,t),{heading:o,body:c,htmlBody:d}=e,p=i===`text_single`?`default`:i===`text_lead`?`centered`:i;if(p===`text_split`)return(0,_.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,_.jsx)(r,{size:`lg`,children:(0,_.jsxs)(`div`,{className:`flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-16`,children:[o&&(0,_.jsx)(`div`,{className:`lg:w-1/3 lg:shrink-0`,children:(0,_.jsx)(l,{variant:`h2`,style:{fontFamily:`var(--font-heading)`,fontWeight:`var(--font-heading-weight)`},children:o})}),d?(0,_.jsx)(`div`,{className:`flex-1 min-w-0 prose prose-neutral max-w-none`,dangerouslySetInnerHTML:{__html:d}}):c&&c.length>0?(0,_.jsx)(`div`,{className:`flex-1 min-w-0`,children:(0,_.jsx)(h,{blocks:c,className:`prose-neutral max-w-none`})}):null]})})});let m=p===`centered`;return(0,_.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,_.jsx)(r,{size:`md`,children:(0,_.jsxs)(s,{gap:6,children:[o&&(0,_.jsx)(l,{variant:`h2`,align:m?`center`:void 0,balance:m,children:o}),d?(0,_.jsx)(`div`,{className:`prose prose-neutral max-w-none${m?` text-center`:``}`,dangerouslySetInnerHTML:{__html:d}}):c&&c.length>0?(0,_.jsx)(`div`,{className:m?`text-center`:void 0,children:(0,_.jsx)(h,{blocks:c,className:m?`prose-neutral mx-auto`:`prose-neutral max-w-none`})}):null]})})})}var _,v=e((()=>{_=t(),n(),i(),o(),c(),d(),m(),p(),g.__docgenInfo={description:``,methods:[],displayName:`TextSectionBlock`,props:{data:{required:!0,tsType:{name:`TextSectionBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``},surface:{required:!1,tsType:{name:`BlockSurface`},description:``}}}})),y,b,x,S,C,w;e((()=>{v(),y=[{_type:`block`,_key:`t1`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s1`,text:`These Terms of Service govern your use of the platform. By creating an account you agree to be bound by them. We have tried to keep the language as plain as possible — if something is unclear, please reach out.`,marks:[]}]},{_type:`block`,_key:`t2`,style:`h3`,markDefs:[],children:[{_type:`span`,_key:`s2`,text:`1. Use of the service`,marks:[]}]},{_type:`block`,_key:`t3`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s3`,text:`You may only use the service for lawful purposes and in accordance with these Terms. You agree not to use the service in any way that violates any applicable local, national, or international law or regulation.`,marks:[]}]},{_type:`block`,_key:`t4`,style:`h3`,markDefs:[],children:[{_type:`span`,_key:`s4`,text:`2. Intellectual property`,marks:[]}]},{_type:`block`,_key:`t5`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s5`,text:`The service and its original content (excluding user-generated content) are and will remain the exclusive property of the company and its licensors.`,marks:[]}]}],b={title:`Blocks/Sections/TextSection`,component:g,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Heading + Portable Text body section. Three variants: text_single (left-aligned column), text_split (heading label left, body right), text_lead (centred large-lead treatment).`}}}},x={name:`text_single — left-aligned column (default)`,args:{data:{heading:`Terms of Service`,body:y},variant:`text_single`}},S={name:`text_split — heading left, body right`,args:{data:{heading:`Privacy Policy`,body:y},variant:`text_split`}},C={name:`text_lead — centred large-lead treatment`,args:{data:{heading:`A better way to manage content`,body:[{_type:`block`,_key:`l1`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s1`,text:`We built this platform because we were tired of watching great ideas get stuck in slow processes. Content should flow freely — from idea to audience — without friction.`,marks:[]}]}]},variant:`text_lead`}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "text_single — left-aligned column (default)",
  args: {
    data: {
      heading: "Terms of Service",
      body
    } satisfies TextSectionBlockData,
    variant: "text_single"
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "text_split — heading left, body right",
  args: {
    data: {
      heading: "Privacy Policy",
      body
    } satisfies TextSectionBlockData,
    variant: "text_split"
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "text_lead — centred large-lead treatment",
  args: {
    data: {
      heading: "A better way to manage content",
      body: [{
        _type: "block",
        _key: "l1",
        style: "normal",
        markDefs: [],
        children: [{
          _type: "span",
          _key: "s1",
          text: "We built this platform because we were tired of watching great ideas get stuck in slow processes. Content should flow freely — from idea to audience — without friction.",
          marks: []
        }]
      }]
    } satisfies TextSectionBlockData,
    variant: "text_lead"
  }
}`,...C.parameters?.docs?.source}}},w=[`Single`,`Split`,`Lead`]}))();export{C as Lead,x as Single,S as Split,w as __namedExportsOrder,b as default};