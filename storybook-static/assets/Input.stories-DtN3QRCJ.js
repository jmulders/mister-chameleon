import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Input-gVwPGEuc.js";var i,a,o,s,c,l,u,d;e((()=>{i=t(),n(),a={title:`Atoms/Form/Input`,component:r,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Token-driven `<input>` atom. Inherits all native input attributes. Styling is driven entirely by CSS custom properties — colours, radius, and border."}}},argTypes:{type:{control:`select`,options:[`text`,`email`,`tel`,`url`,`password`,`search`,`number`]},placeholder:{control:`text`},disabled:{control:`boolean`},error:{control:`boolean`,description:`Applies error-state border colour.`}},args:{type:`text`,placeholder:`Enter a value…`,error:!1,disabled:!1},decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:`24rem`},children:(0,i.jsx)(e,{})})]},o={},s={name:`With value`,args:{defaultValue:`example@domain.com`,type:`email`}},c={name:`Error state`,args:{error:!0,defaultValue:`bad-email`,type:`email`}},l={args:{disabled:!0,defaultValue:`Cannot be edited`}},u={name:`All input types`,render:()=>(0,i.jsxs)(`div`,{className:`flex flex-col gap-3`,style:{maxWidth:`24rem`},children:[(0,i.jsx)(r,{type:`text`,placeholder:`text`}),(0,i.jsx)(r,{type:`email`,placeholder:`email`}),(0,i.jsx)(r,{type:`tel`,placeholder:`tel`}),(0,i.jsx)(r,{type:`url`,placeholder:`url`}),(0,i.jsx)(r,{type:`password`,placeholder:`password`}),(0,i.jsx)(r,{type:`search`,placeholder:`search`}),(0,i.jsx)(r,{type:`number`,placeholder:`number`})]})},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "With value",
  args: {
    defaultValue: "example@domain.com",
    type: "email"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Error state",
  args: {
    error: true,
    defaultValue: "bad-email",
    type: "email"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    defaultValue: "Cannot be edited"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "All input types",
  render: () => <div className="flex flex-col gap-3" style={{
    maxWidth: "24rem"
  }}>
      <Input type="text" placeholder="text" />
      <Input type="email" placeholder="email" />
      <Input type="tel" placeholder="tel" />
      <Input type="url" placeholder="url" />
      <Input type="password" placeholder="password" />
      <Input type="search" placeholder="search" />
      <Input type="number" placeholder="number" />
    </div>
}`,...u.parameters?.docs?.source}}},d=[`Default`,`WithValue`,`ErrorState`,`Disabled`,`InputTypes`]}))();export{o as Default,l as Disabled,c as ErrorState,u as InputTypes,s as WithValue,d as __namedExportsOrder,a as default};