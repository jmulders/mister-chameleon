import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";var i,a,o,s,c,l,u;e((()=>{i=t(),n(),a={title:`Atoms/Container`,component:r,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Constrains content to a max-width with symmetric horizontal padding. Always pair with `Section` for a complete layout unit. Five sizes: `sm` (640px), `md` (896px), `lg` (1152px default), `xl` (1280px), `full` (no max)."}}},argTypes:{size:{control:`select`,options:[`sm`,`md`,`lg`,`xl`,`full`]}},args:{size:`lg`}},o=({label:e})=>(0,i.jsx)(`div`,{style:{background:`var(--primary, #6366f1)`,color:`#fff`,padding:`1rem`,fontSize:`0.875rem`,fontWeight:500,borderRadius:`0.375rem`,textAlign:`center`},children:e}),s={render:e=>(0,i.jsx)(`div`,{style:{background:`var(--section-subtle-bg, #f8fafc)`,padding:`2rem 0`},children:(0,i.jsx)(r,{...e,children:(0,i.jsx)(o,{label:`size="${e.size}" — content area`})})})},c={name:`All sizes`,render:()=>(0,i.jsx)(`div`,{style:{background:`var(--section-subtle-bg, #f8fafc)`,padding:`2rem 0`,display:`flex`,flexDirection:`column`,gap:`1rem`},children:[`sm`,`md`,`lg`,`xl`,`full`].map(e=>(0,i.jsx)(r,{size:e,children:(0,i.jsx)(o,{label:`size="${e}"`})},e))})},l={name:`Semantic element (as=main)`,render:()=>(0,i.jsx)(r,{as:`main`,size:`md`,children:(0,i.jsx)(o,{label:`Rendered as <main>`})})},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: args => <div style={{
    background: "var(--section-subtle-bg, #f8fafc)",
    padding: "2rem 0"
  }}>
      <Container {...args}>
        <Filler label={\`size="\${args.size}" — content area\`} />
      </Container>
    </div>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "All sizes",
  render: () => <div style={{
    background: "var(--section-subtle-bg, #f8fafc)",
    padding: "2rem 0",
    display: "flex",
    flexDirection: "column",
    gap: "1rem"
  }}>
      {(["sm", "md", "lg", "xl", "full"] as const).map(size => <Container key={size} size={size}>
          <Filler label={\`size="\${size}"\`} />
        </Container>)}
    </div>
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "Semantic element (as=main)",
  render: () => <Container as="main" size="md">
      <Filler label="Rendered as <main>" />
    </Container>
}`,...l.parameters?.docs?.source}}},u=[`Default`,`AllSizes`,`AsMain`]}))();export{c as AllSizes,l as AsMain,s as Default,u as __namedExportsOrder,a as default};