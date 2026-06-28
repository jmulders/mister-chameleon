import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Text-Dp98UGuY.js";var i,a,o,s,c,l,u;e((()=>{i=t(),n(),a={title:`Atoms/Text`,component:r,tags:[`autodocs`],parameters:{docs:{description:{component:"Polymorphic typography primitive. Covers the full type scale from `display` hero headings to `caption` labels. The `as` prop overrides the default element for semantic flexibility."}}},argTypes:{variant:{control:`select`,options:[`display`,`h1`,`h2`,`h3`,`h4`,`body`,`body-sm`,`caption`,`label`]},color:{control:`select`,options:[`default`,`muted`,`subtle`,`brand`,`inverse`,`inherit`]},align:{control:`select`,options:[`left`,`center`,`right`]},weight:{control:`select`,options:[`normal`,`medium`,`semibold`,`bold`]},balance:{control:`boolean`},children:{control:`text`}},args:{variant:`body`,color:`default`,children:`The quick brown fox jumps over the lazy dog.`}},o={},s={name:`Full type scale`,render:()=>(0,i.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`1.25rem`},children:[(0,i.jsx)(r,{variant:`display`,children:`Display — Hero headline`}),(0,i.jsx)(r,{variant:`h1`,children:`H1 — Page title`}),(0,i.jsx)(r,{variant:`h2`,children:`H2 — Section heading`}),(0,i.jsx)(r,{variant:`h3`,children:`H3 — Block heading`}),(0,i.jsx)(r,{variant:`h4`,children:`H4 — Card heading`}),(0,i.jsx)(r,{variant:`body`,children:`Body — Paragraph text. The quick brown fox jumps over the lazy dog.`}),(0,i.jsx)(r,{variant:`body-sm`,children:`Body small — Supporting text for compact layouts.`}),(0,i.jsx)(r,{variant:`caption`,children:`Caption — Meta info, timestamps, fine print.`}),(0,i.jsx)(r,{variant:`label`,children:`Label — Form label or UI chip.`})]})},c={name:`Colour variants`,render:()=>(0,i.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`0.75rem`},children:[(0,i.jsx)(r,{color:`default`,children:`Default colour`}),(0,i.jsx)(r,{color:`muted`,children:`Muted — secondary prose`}),(0,i.jsx)(r,{color:`subtle`,children:`Subtle — de-emphasised`}),(0,i.jsx)(r,{color:`brand`,children:`Brand — accent text`}),(0,i.jsx)(`div`,{style:{background:`#0f172a`,padding:`0.75rem 1rem`,borderRadius:`0.5rem`},children:(0,i.jsx)(r,{color:`inverse`,children:`Inverse — for dark surfaces`})})]})},l={name:`Text alignment`,render:()=>(0,i.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`0.75rem`,maxWidth:`32rem`},children:[(0,i.jsx)(r,{align:`left`,children:`Left-aligned text (default)`}),(0,i.jsx)(r,{align:`center`,children:`Centre-aligned text`}),(0,i.jsx)(r,{align:`right`,children:`Right-aligned text`})]})},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "Full type scale",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem"
  }}>
      <Text variant="display">Display — Hero headline</Text>
      <Text variant="h1">H1 — Page title</Text>
      <Text variant="h2">H2 — Section heading</Text>
      <Text variant="h3">H3 — Block heading</Text>
      <Text variant="h4">H4 — Card heading</Text>
      <Text variant="body">Body — Paragraph text. The quick brown fox jumps over the lazy dog.</Text>
      <Text variant="body-sm">Body small — Supporting text for compact layouts.</Text>
      <Text variant="caption">Caption — Meta info, timestamps, fine print.</Text>
      <Text variant="label">Label — Form label or UI chip.</Text>
    </div>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Colour variants",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  }}>
      <Text color="default">Default colour</Text>
      <Text color="muted">Muted — secondary prose</Text>
      <Text color="subtle">Subtle — de-emphasised</Text>
      <Text color="brand">Brand — accent text</Text>
      <div style={{
      background: "#0f172a",
      padding: "0.75rem 1rem",
      borderRadius: "0.5rem"
    }}>
        <Text color="inverse">Inverse — for dark surfaces</Text>
      </div>
    </div>
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "Text alignment",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    maxWidth: "32rem"
  }}>
      <Text align="left">Left-aligned text (default)</Text>
      <Text align="center">Centre-aligned text</Text>
      <Text align="right">Right-aligned text</Text>
    </div>
}`,...l.parameters?.docs?.source}}},u=[`Body`,`TypeScale`,`ColorVariants`,`Alignment`]}))();export{l as Alignment,o as Body,c as ColorVariants,s as TypeScale,u as __namedExportsOrder,a as default};