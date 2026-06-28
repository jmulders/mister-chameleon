import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Input-gVwPGEuc.js";import{n as i,t as a}from"./Textarea-DvdgP5Ay.js";import{n as o,t as s}from"./Select-BOQCbpa_.js";import{n as c,t as l}from"./FormField-JkzK2vsx.js";var u,d,f,p,m,h,g,_,v;e((()=>{u=t(),c(),n(),i(),o(),d={title:`Atoms/Form/FormField`,component:l,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Composable form field wrapper: label → input → hint / error. Handles accessible wiring (`htmlFor`, `aria-describedby`, `role=alert`). Accepts a plain child node or a render-prop to receive the generated error ID."}}},argTypes:{label:{control:`text`},htmlFor:{control:`text`},required:{control:`boolean`},hint:{control:`text`},error:{control:`text`,description:`Validation error message. Replaces hint when set.`}},args:{label:`Email address`,htmlFor:`email`,required:!1,hint:``,error:``},decorators:[e=>(0,u.jsx)(`div`,{style:{maxWidth:`24rem`},children:(0,u.jsx)(e,{})})],render:e=>(0,u.jsx)(l,{...e,children:(0,u.jsx)(r,{id:`email`,name:`email`,type:`email`,placeholder:`you@example.com`})})},f={},p={args:{label:`Email address`,htmlFor:`email-req`,required:!0,hint:`We'll never share your email.`},render:e=>(0,u.jsx)(l,{...e,children:(0,u.jsx)(r,{id:`email-req`,name:`email`,type:`email`,placeholder:`you@example.com`})})},m={name:`With hint`,args:{hint:`Use a strong password of at least 8 characters.`,htmlFor:`pwd`,label:`Password`},render:e=>(0,u.jsx)(l,{...e,children:(0,u.jsx)(r,{id:`pwd`,name:`password`,type:`password`})})},h={name:`With validation error`,args:{error:`Please enter a valid email address.`,htmlFor:`email-err`,label:`Email address`},render:e=>(0,u.jsx)(l,{...e,children:e=>(0,u.jsx)(r,{id:`email-err`,name:`email`,type:`email`,error:!0,"aria-invalid":!0,"aria-describedby":e,defaultValue:`not-an-email`})})},g={name:`Textarea field`,args:{label:`Message`,htmlFor:`msg`,required:!0},render:e=>(0,u.jsx)(l,{...e,children:(0,u.jsx)(a,{id:`msg`,name:`message`,placeholder:`Your message…`,rows:4})})},_={name:`Select field`,args:{label:`Department`,htmlFor:`dept`},render:e=>(0,u.jsx)(l,{...e,children:(0,u.jsxs)(s,{id:`dept`,name:`department`,children:[(0,u.jsx)(`option`,{value:``,children:`Choose a department`}),(0,u.jsx)(`option`,{value:`eng`,children:`Engineering`}),(0,u.jsx)(`option`,{value:`design`,children:`Design`}),(0,u.jsx)(`option`,{value:`marketing`,children:`Marketing`})]})})},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Email address",
    htmlFor: "email-req",
    required: true,
    hint: "We'll never share your email."
  },
  render: args => <FormField {...args}>
      <Input id="email-req" name="email" type="email" placeholder="you@example.com" />
    </FormField>
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "With hint",
  args: {
    hint: "Use a strong password of at least 8 characters.",
    htmlFor: "pwd",
    label: "Password"
  },
  render: args => <FormField {...args}>
      <Input id="pwd" name="password" type="password" />
    </FormField>
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "With validation error",
  args: {
    error: "Please enter a valid email address.",
    htmlFor: "email-err",
    label: "Email address"
  },
  render: args => <FormField {...args}>
      {errorId => <Input id="email-err" name="email" type="email" error aria-invalid aria-describedby={errorId} defaultValue="not-an-email" />}
    </FormField>
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "Textarea field",
  args: {
    label: "Message",
    htmlFor: "msg",
    required: true
  },
  render: args => <FormField {...args}>
      <Textarea id="msg" name="message" placeholder="Your message…" rows={4} />
    </FormField>
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "Select field",
  args: {
    label: "Department",
    htmlFor: "dept"
  },
  render: args => <FormField {...args}>
      <Select id="dept" name="department">
        <option value="">Choose a department</option>
        <option value="eng">Engineering</option>
        <option value="design">Design</option>
        <option value="marketing">Marketing</option>
      </Select>
    </FormField>
}`,..._.parameters?.docs?.source}}},v=[`Default`,`Required`,`WithHint`,`WithError`,`WithTextarea`,`WithSelect`]}))();export{f as Default,p as Required,h as WithError,m as WithHint,_ as WithSelect,g as WithTextarea,v as __namedExportsOrder,d as default};