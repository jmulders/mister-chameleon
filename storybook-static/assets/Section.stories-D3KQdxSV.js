import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";var o,s,c,l,u,d,f;e((()=>{o=t(),i(),n(),s={title:`Atoms/Section`,component:a,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Semantic `<section>` with standardised vertical padding. Always pair with `Container` for a complete layout unit. Five spacing presets: `sm` (40px), `md` (64px), `lg` (96px), `xl` (128px), `none`."}}},argTypes:{spacing:{control:`select`,options:[`none`,`sm`,`md`,`lg`,`xl`]}},args:{spacing:`md`}},c=({label:e})=>(0,o.jsx)(r,{size:`lg`,children:(0,o.jsx)(`div`,{style:{background:`var(--primary, #6366f1)`,color:`#fff`,padding:`1rem`,borderRadius:`0.5rem`,textAlign:`center`,fontSize:`0.875rem`,fontWeight:500},children:e})}),l={render:e=>(0,o.jsx)(a,{...e,children:(0,o.jsx)(c,{label:`spacing="${e.spacing}" — section content area`})})},u={name:`All spacing variants`,render:()=>(0,o.jsx)(`div`,{children:[`none`,`sm`,`md`,`lg`,`xl`].map((e,t)=>(0,o.jsx)(a,{spacing:e,style:{background:t%2==0?`var(--section-subtle-bg, #f8fafc)`:`white`},children:(0,o.jsx)(c,{label:`spacing="${e}"`})},e))})},d={name:`With background token`,render:()=>(0,o.jsx)(a,{spacing:`lg`,style:{background:`var(--section-cta-bg, #4f46e5)`},children:(0,o.jsx)(r,{size:`md`,children:(0,o.jsx)(`div`,{style:{color:`#fff`,textAlign:`center`,fontWeight:600},children:`Section with background token`})})})},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: args => <Section {...args}>
      <InnerContent label={\`spacing="\${args.spacing}" — section content area\`} />
    </Section>
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "All spacing variants",
  render: () => <div>
      {(["none", "sm", "md", "lg", "xl"] as const).map((spacing, i) => <Section key={spacing} spacing={spacing} style={{
      background: i % 2 === 0 ? "var(--section-subtle-bg, #f8fafc)" : "white"
    }}>
          <InnerContent label={\`spacing="\${spacing}"\`} />
        </Section>)}
    </div>
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "With background token",
  render: () => <Section spacing="lg" style={{
    background: "var(--section-cta-bg, #4f46e5)"
  }}>
      <Container size="md">
        <div style={{
        color: "#fff",
        textAlign: "center",
        fontWeight: 600
      }}>
          Section with background token
        </div>
      </Container>
    </Section>
}`,...d.parameters?.docs?.source}}},f=[`Default`,`AllSpacings`,`WithBackground`]}))();export{u as AllSpacings,l as Default,d as WithBackground,f as __namedExportsOrder,s as default};