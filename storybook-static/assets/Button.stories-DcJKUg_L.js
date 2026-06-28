import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Button-CxkYI-eU.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_;e((()=>{i=t(),n(),a={title:`Atoms/Button`,component:r,tags:[`autodocs`],parameters:{layout:`centered`,docs:{description:{component:"The primary interactive element. Four visual variants × three sizes. Renders as `<button>` by default; pass `as='a'` with `href` for navigation."}}},argTypes:{variant:{control:`select`,options:[`primary`,`secondary`,`outline`,`ghost`],description:`Visual emphasis level.`},size:{control:`select`,options:[`sm`,`md`,`lg`],description:`Height and horizontal padding.`},loading:{control:`boolean`,description:`Shows a spinner and disables the button.`},disabled:{control:`boolean`},children:{control:`text`}},args:{children:`Button label`,variant:`primary`,size:`md`,loading:!1,disabled:!1}},o={args:{variant:`primary`}},s={args:{variant:`secondary`}},c={args:{variant:`outline`}},l={args:{variant:`ghost`}},u={args:{size:`sm`}},d={args:{size:`md`}},f={args:{size:`lg`}},p={args:{loading:!0,children:`Saving…`}},m={args:{disabled:!0}},h={name:`All variants`,render:()=>(0,i.jsxs)(`div`,{className:`flex flex-wrap items-center gap-3`,children:[(0,i.jsx)(r,{variant:`primary`,children:`Primary`}),(0,i.jsx)(r,{variant:`secondary`,children:`Secondary`}),(0,i.jsx)(r,{variant:`outline`,children:`Outline`}),(0,i.jsx)(r,{variant:`ghost`,children:`Ghost`})]})},g={name:`All sizes`,render:()=>(0,i.jsxs)(`div`,{className:`flex flex-wrap items-end gap-3`,children:[(0,i.jsx)(r,{size:`sm`,children:`Small`}),(0,i.jsx)(r,{size:`md`,children:`Medium`}),(0,i.jsx)(r,{size:`lg`,children:`Large`})]})},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "primary"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "secondary"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "outline"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "ghost"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    size: "sm"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    size: "md"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    size: "lg"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true,
    children: "Saving…"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "All variants",
  render: () => <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "All sizes",
  render: () => <div className="flex flex-wrap items-end gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
}`,...g.parameters?.docs?.source}}},_=[`Primary`,`Secondary`,`Outline`,`Ghost`,`Small`,`Medium`,`Large`,`Loading`,`Disabled`,`AllVariants`,`AllSizes`]}))();export{g as AllSizes,h as AllVariants,m as Disabled,l as Ghost,f as Large,p as Loading,d as Medium,c as Outline,o as Primary,s as Secondary,u as Small,_ as __namedExportsOrder,a as default};