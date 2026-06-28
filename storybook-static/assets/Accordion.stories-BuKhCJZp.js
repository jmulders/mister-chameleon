import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Text-Dp98UGuY.js";import{n as i,r as a,t as o}from"./Accordion-DefhAFOE.js";var s,c,l,u,d,f,p,m;e((()=>{s=t(),a(),n(),c={title:`Molecules/Accordion`,component:i,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Zero-JS collapsible panel built on native `<details>`/`<summary>`. No JavaScript required — open/close is handled by the browser. The `Accordion` wrapper stacks multiple `AccordionItem` elements with consistent gap."}}},argTypes:{title:{control:`text`},defaultOpen:{control:`boolean`}},args:{title:`What is included in the plan?`,defaultOpen:!1},decorators:[e=>(0,s.jsx)(`div`,{style:{maxWidth:`40rem`},children:(0,s.jsx)(e,{})})],render:e=>(0,s.jsx)(i,{...e,children:(0,s.jsx)(r,{color:`muted`,children:`Our plan includes unlimited access to all features, priority support, and monthly reporting. You can cancel at any time with no penalties.`})})},l={},u={name:`Open by default`,args:{defaultOpen:!0}},d={name:`FAQ group (Accordion wrapper)`,render:()=>(0,s.jsx)(`div`,{style:{maxWidth:`40rem`},children:(0,s.jsxs)(o,{children:[(0,s.jsx)(i,{title:`What is included in the plan?`,defaultOpen:!0,children:(0,s.jsx)(r,{color:`muted`,children:`All plans include unlimited access to features, priority support, and monthly reports.`})}),(0,s.jsx)(i,{title:`Can I cancel at any time?`,children:(0,s.jsx)(r,{color:`muted`,children:`Yes — cancel from your account settings at any time with no additional fees.`})}),(0,s.jsx)(i,{title:`Is there a free trial?`,children:(0,s.jsx)(r,{color:`muted`,children:`We offer a 14-day free trial on all plans. No credit card required.`})}),(0,s.jsx)(i,{title:`How does billing work?`,children:(0,s.jsx)(r,{color:`muted`,children:`Billing is monthly or annual. Annual plans receive a 20% discount automatically.`})})]})})},f={name:`Single item (no wrapper)`,render:()=>(0,s.jsx)(`div`,{style:{maxWidth:`40rem`},children:(0,s.jsx)(i,{title:`Expand for more detail`,defaultOpen:!0,children:(0,s.jsx)(r,{color:`muted`,children:`This is a standalone accordion item used outside of an Accordion group wrapper. Useful for inline progressive disclosure.`})})})},p={name:`Tight gap variant`,render:()=>(0,s.jsx)(`div`,{style:{maxWidth:`40rem`},children:(0,s.jsxs)(o,{gap:1,children:[(0,s.jsx)(i,{title:`Section A`,children:(0,s.jsx)(r,{color:`muted`,children:`Content for section A.`})}),(0,s.jsx)(i,{title:`Section B`,children:(0,s.jsx)(r,{color:`muted`,children:`Content for section B.`})}),(0,s.jsx)(i,{title:`Section C`,children:(0,s.jsx)(r,{color:`muted`,children:`Content for section C.`})})]})})},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Open by default",
  args: {
    defaultOpen: true
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "FAQ group (Accordion wrapper)",
  render: () => <div style={{
    maxWidth: "40rem"
  }}>
      <Accordion>
        <AccordionItem title="What is included in the plan?" defaultOpen>
          <Text color="muted">
            All plans include unlimited access to features, priority support, and monthly reports.
          </Text>
        </AccordionItem>
        <AccordionItem title="Can I cancel at any time?">
          <Text color="muted">
            Yes — cancel from your account settings at any time with no additional fees.
          </Text>
        </AccordionItem>
        <AccordionItem title="Is there a free trial?">
          <Text color="muted">
            We offer a 14-day free trial on all plans. No credit card required.
          </Text>
        </AccordionItem>
        <AccordionItem title="How does billing work?">
          <Text color="muted">
            Billing is monthly or annual. Annual plans receive a 20% discount automatically.
          </Text>
        </AccordionItem>
      </Accordion>
    </div>
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Single item (no wrapper)",
  render: () => <div style={{
    maxWidth: "40rem"
  }}>
      <AccordionItem title="Expand for more detail" defaultOpen>
        <Text color="muted">
          This is a standalone accordion item used outside of an Accordion group wrapper.
          Useful for inline progressive disclosure.
        </Text>
      </AccordionItem>
    </div>
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Tight gap variant",
  render: () => <div style={{
    maxWidth: "40rem"
  }}>
      <Accordion gap={1}>
        <AccordionItem title="Section A">
          <Text color="muted">Content for section A.</Text>
        </AccordionItem>
        <AccordionItem title="Section B">
          <Text color="muted">Content for section B.</Text>
        </AccordionItem>
        <AccordionItem title="Section C">
          <Text color="muted">Content for section C.</Text>
        </AccordionItem>
      </Accordion>
    </div>
}`,...p.parameters?.docs?.source}}},m=[`Default`,`OpenByDefault`,`FAQGroup`,`SingleItem`,`TightGap`]}))();export{l as Default,d as FAQGroup,u as OpenByDefault,f as SingleItem,p as TightGap,m as __namedExportsOrder,c as default};