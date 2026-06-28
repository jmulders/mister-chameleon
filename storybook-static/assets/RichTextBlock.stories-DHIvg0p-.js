import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./PortableTextRenderer-CfV_W9A9.js";function c({data:e,variant:t}){let{body:n,htmlBody:i,maxWidth:o}=e,c=o??(t===`narrow`?`narrow`:t===`wide`?`wide`:`default`),u=c===`narrow`?`sm`:c===`wide`?`lg`:`md`;return i?(0,l.jsx)(a,{spacing:`md`,children:(0,l.jsx)(r,{size:u,children:(0,l.jsx)(`div`,{className:`mc-rich-text`,dangerouslySetInnerHTML:{__html:i}})})}):!n||n.length===0?null:(0,l.jsx)(a,{spacing:`md`,children:(0,l.jsx)(r,{size:u,children:(0,l.jsx)(s,{blocks:n,className:`mc-rich-text`})})})}var l,u=e((()=>{l=t(),n(),i(),o(),c.__docgenInfo={description:``,methods:[],displayName:`RichTextBlock`,props:{data:{required:!0,tsType:{name:`RichTextBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),d,f,p,m,h,g;e((()=>{u(),d=[{_type:`block`,_key:`r1`,style:`h2`,markDefs:[],children:[{_type:`span`,_key:`s1`,text:`Why content architecture matters`,marks:[]}]},{_type:`block`,_key:`r2`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s2`,text:`Most teams underestimate the cost of unstructured content. When editorial copy lives as blobs of HTML, `,marks:[]},{_type:`span`,_key:`s3`,text:`migrating, repurposing, and governing it becomes an engineering problem`,marks:[`strong`]},{_type:`span`,_key:`s4`,text:` instead of an editorial one.`,marks:[]}]},{_type:`block`,_key:`r3`,style:`blockquote`,markDefs:[],children:[{_type:`span`,_key:`s5`,text:`Structure is the difference between content you own and content that owns you.`,marks:[]}]},{_type:`block`,_key:`r4`,style:`h3`,markDefs:[],children:[{_type:`span`,_key:`s6`,text:`The three-layer model`,marks:[]}]},{_type:`block`,_key:`r5`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s7`,text:`Think of your content stack in three layers: the `,marks:[]},{_type:`span`,_key:`s8`,text:`schema layer`,marks:[`em`]},{_type:`span`,_key:`s9`,text:` (what fields exist), the `,marks:[]},{_type:`span`,_key:`s10`,text:`authoring layer`,marks:[`em`]},{_type:`span`,_key:`s11`,text:` (how editors create content), and the `,marks:[]},{_type:`span`,_key:`s12`,text:`delivery layer`,marks:[`em`]},{_type:`span`,_key:`s13`,text:` (how content reaches its audience). Each layer has different owners and different change rates.`,marks:[]}]}],f={title:`Blocks/Sections/RichText`,component:c,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`General-purpose Portable Text body drop-in. The block-level maxWidth field takes priority over the variant prop. Three width options: narrow, default, wide.`}}}},p={name:`default — standard content-column width`,args:{data:{body:d},variant:`default`}},m={name:`narrow — ~65ch reading-width column`,args:{data:{body:d,maxWidth:`narrow`},variant:`narrow`}},h={name:`wide — full container width`,args:{data:{body:d,maxWidth:`wide`},variant:`wide`}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "default — standard content-column width",
  args: {
    data: {
      body
    },
    variant: "default"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "narrow — ~65ch reading-width column",
  args: {
    data: {
      body,
      maxWidth: "narrow"
    },
    variant: "narrow"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "wide — full container width",
  args: {
    data: {
      body,
      maxWidth: "wide"
    },
    variant: "wide"
  }
}`,...h.parameters?.docs?.source}}},g=[`Default`,`Narrow`,`Wide`]}))();export{p as Default,m as Narrow,h as Wide,g as __namedExportsOrder,f as default};