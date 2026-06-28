import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Badge-Cce64JkJ.js";var i,a,o,s,c,l,u,d,f,p,m;e((()=>{i=t(),n(),a={title:`Atoms/Badge`,component:r,tags:[`autodocs`],parameters:{layout:`centered`,docs:{description:{component:`Small inline label for statuses, categories, and counts. Six semantic colour variants + optional leading dot indicator.`}}},argTypes:{variant:{control:`select`,options:[`default`,`primary`,`success`,`warning`,`error`,`outline`]},size:{control:`select`,options:[`sm`,`md`]},dot:{control:`boolean`,description:`Shows a coloured dot before the label.`},children:{control:`text`}},args:{children:`Badge`,variant:`default`,size:`sm`,dot:!1}},o={},s={args:{variant:`primary`,children:`New`}},c={args:{variant:`success`,children:`Active`}},l={args:{variant:`warning`,children:`Pending`}},u={args:{variant:`error`,children:`Failed`}},d={args:{variant:`outline`,children:`Inactive`}},f={name:`With dot`,args:{variant:`success`,children:`Online`,dot:!0}},p={name:`All variants`,render:()=>(0,i.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,i.jsx)(r,{variant:`default`,children:`Default`}),(0,i.jsx)(r,{variant:`primary`,children:`Primary`}),(0,i.jsx)(r,{variant:`success`,dot:!0,children:`Success`}),(0,i.jsx)(r,{variant:`warning`,dot:!0,children:`Warning`}),(0,i.jsx)(r,{variant:`error`,dot:!0,children:`Error`}),(0,i.jsx)(r,{variant:`outline`,children:`Outline`})]})},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "primary",
    children: "New"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "success",
    children: "Active"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "warning",
    children: "Pending"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "error",
    children: "Failed"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    variant: "outline",
    children: "Inactive"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "With dot",
  args: {
    variant: "success",
    children: "Online",
    dot: true
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "All variants",
  render: () => <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="success" dot>Success</Badge>
      <Badge variant="warning" dot>Warning</Badge>
      <Badge variant="error" dot>Error</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
}`,...p.parameters?.docs?.source}}},m=[`Default`,`Primary`,`Success`,`Warning`,`Error`,`Outline`,`WithDot`,`AllVariants`]}))();export{p as AllVariants,o as Default,u as Error,d as Outline,s as Primary,c as Success,l as Warning,f as WithDot,m as __namedExportsOrder,a as default};