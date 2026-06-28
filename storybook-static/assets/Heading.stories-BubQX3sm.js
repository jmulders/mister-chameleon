import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Text-Dp98UGuY.js";function i({level:e=2,size:t,...n}){let i=t??o[e];return(0,a.jsx)(r,{as:`h${e}`,variant:i,...n})}var a,o,s=e((()=>{a=t(),n(),o={1:`h1`,2:`h2`,3:`h3`,4:`h4`,5:`h4`,6:`h4`},i.__docgenInfo={description:``,methods:[],displayName:`Heading`,props:{level:{required:!1,tsType:{name:`union`,raw:`1 | 2 | 3 | 4 | 5 | 6`,elements:[{name:`literal`,value:`1`},{name:`literal`,value:`2`},{name:`literal`,value:`3`},{name:`literal`,value:`4`},{name:`literal`,value:`5`},{name:`literal`,value:`6`}]},description:`Semantic HTML heading level — controls the rendered element and
document outline. Defaults to 2 (h2).`,defaultValue:{value:`2`,computed:!1}},size:{required:!1,tsType:{name:`union`,raw:`"display" | "h1" | "h2" | "h3" | "h4"`,elements:[{name:`literal`,value:`"display"`},{name:`literal`,value:`"h1"`},{name:`literal`,value:`"h2"`},{name:`literal`,value:`"h3"`},{name:`literal`,value:`"h4"`}]},description:`Visual scale, independent of the semantic level.
Defaults to the matching scale for the level (h1→"h1", h2→"h2", etc.;
h5 and h6 fall back to "h4" since there is no dedicated size below h4).`}},composes:[`Omit`]}})),c,l,u,d,f,p,m,h,g;e((()=>{c=t(),s(),l={title:`Atoms/Heading`,component:i,tags:[`autodocs`],parameters:{docs:{description:{component:"Semantic heading primitive that decouples HTML level from visual scale. Use `level` to set the document outline (h1–h6); use `size` to override the visual scale independently. When `size` is omitted it defaults to the matching visual scale for the level."}}},argTypes:{level:{control:`select`,options:[1,2,3,4,5,6]},size:{control:`select`,options:[`display`,`h1`,`h2`,`h3`,`h4`]},align:{control:`select`,options:[`left`,`center`,`right`]},color:{control:`select`,options:[`default`,`muted`,`brand`,`subtle`]},balance:{control:`boolean`}},args:{level:2,children:`The quick brown fox jumps over the lazy dog`}},u={},d={name:`Display scale (hero headings)`,args:{level:1,size:`display`,children:`Welcome to the platform`}},f={name:`All semantic levels`,render:()=>(0,c.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`0.75rem`},children:[1,2,3,4,5,6].map(e=>(0,c.jsxs)(i,{level:e,children:[`Heading level `,e,` — h`,e,` element`]},e))})},p={name:`Decoupled level vs scale`,render:()=>(0,c.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`0.75rem`},children:[(0,c.jsx)(i,{level:2,size:`display`,children:`h2 element, display scale`}),(0,c.jsx)(i,{level:2,size:`h3`,children:`h2 element, h3 scale`}),(0,c.jsx)(i,{level:3,size:`h1`,children:`h3 element, h1 scale`}),(0,c.jsx)(i,{level:4,size:`h2`,children:`h4 element, h2 scale`})]})},m={name:`Centred + balanced`,args:{level:2,align:`center`,balance:!0,children:`Centred section heading with text-wrap balance`}},h={name:`Muted colour`,args:{level:3,color:`muted`,children:`Supporting sub-heading in muted colour`}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Display scale (hero headings)",
  args: {
    level: 1,
    size: "display",
    children: "Welcome to the platform"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "All semantic levels",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  }}>
      {([1, 2, 3, 4, 5, 6] as const).map(level => <Heading key={level} level={level}>
          Heading level {level} — h{level} element
        </Heading>)}
    </div>
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Decoupled level vs scale",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  }}>
      <Heading level={2} size="display">h2 element, display scale</Heading>
      <Heading level={2} size="h3">h2 element, h3 scale</Heading>
      <Heading level={3} size="h1">h3 element, h1 scale</Heading>
      <Heading level={4} size="h2">h4 element, h2 scale</Heading>
    </div>
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "Centred + balanced",
  args: {
    level: 2,
    align: "center",
    balance: true,
    children: "Centred section heading with text-wrap balance"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "Muted colour",
  args: {
    level: 3,
    color: "muted",
    children: "Supporting sub-heading in muted colour"
  }
}`,...h.parameters?.docs?.source}}},g=[`Default`,`Display`,`AllLevels`,`DecoupledScale`,`Centered`,`MutedColor`]}))();export{f as AllLevels,m as Centered,p as DecoupledScale,u as Default,d as Display,h as MutedColor,g as __namedExportsOrder,l as default};