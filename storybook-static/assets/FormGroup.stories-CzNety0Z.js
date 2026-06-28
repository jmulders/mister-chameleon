import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Input-gVwPGEuc.js";import{n as i,t as a}from"./Textarea-DvdgP5Ay.js";import{n as o,t as s}from"./Select-BOQCbpa_.js";import{n as c,t as l}from"./FormField-JkzK2vsx.js";import{n as u,t as d}from"./FormGroup-DRy11A-H.js";var f,p,m,h,g,_,v;e((()=>{f=t(),u(),c(),n(),i(),o(),p={title:`Molecules/FormGroup`,component:d,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Semantic `<fieldset>`/`<legend>` grouper for logically related form fields. When `legend` is omitted, renders a plain `Stack`. Uses design tokens for legend colour and weight."}}},argTypes:{legend:{control:`text`},gap:{control:`select`,options:[2,3,4,5,6,8]}},args:{legend:`Personal details`,gap:5},decorators:[e=>(0,f.jsx)(`div`,{style:{maxWidth:`32rem`},children:(0,f.jsx)(e,{})})]},m={render:e=>(0,f.jsxs)(d,{...e,children:[(0,f.jsx)(l,{label:`First name`,htmlFor:`fn`,children:(0,f.jsx)(r,{id:`fn`,name:`firstName`,placeholder:`Jane`})}),(0,f.jsx)(l,{label:`Last name`,htmlFor:`ln`,children:(0,f.jsx)(r,{id:`ln`,name:`lastName`,placeholder:`Smith`})}),(0,f.jsx)(l,{label:`Email address`,htmlFor:`em`,children:(0,f.jsx)(r,{id:`em`,name:`email`,type:`email`,placeholder:`jane@example.com`})})]})},h={name:`No legend (plain Stack)`,args:{legend:``},render:e=>(0,f.jsxs)(d,{...e,children:[(0,f.jsx)(l,{label:`Email address`,htmlFor:`em2`,children:(0,f.jsx)(r,{id:`em2`,name:`email`,type:`email`,placeholder:`you@example.com`})}),(0,f.jsx)(l,{label:`Password`,htmlFor:`pw`,children:(0,f.jsx)(r,{id:`pw`,name:`password`,type:`password`})})]})},g={name:`Multi-section form`,render:()=>(0,f.jsxs)(`form`,{style:{display:`flex`,flexDirection:`column`,gap:`2rem`},children:[(0,f.jsxs)(d,{legend:`Personal details`,children:[(0,f.jsx)(l,{label:`Full name`,htmlFor:`ms-name`,required:!0,children:(0,f.jsx)(r,{id:`ms-name`,name:`name`,placeholder:`Jane Smith`})}),(0,f.jsx)(l,{label:`Email`,htmlFor:`ms-email`,required:!0,children:(0,f.jsx)(r,{id:`ms-email`,name:`email`,type:`email`,placeholder:`jane@example.com`})})]}),(0,f.jsxs)(d,{legend:`Work details`,children:[(0,f.jsx)(l,{label:`Department`,htmlFor:`ms-dept`,children:(0,f.jsxs)(s,{id:`ms-dept`,name:`department`,children:[(0,f.jsx)(`option`,{value:``,children:`Choose a department`}),(0,f.jsx)(`option`,{value:`eng`,children:`Engineering`}),(0,f.jsx)(`option`,{value:`design`,children:`Design`}),(0,f.jsx)(`option`,{value:`marketing`,children:`Marketing`})]})}),(0,f.jsx)(l,{label:`Motivation`,htmlFor:`ms-msg`,children:(0,f.jsx)(a,{id:`ms-msg`,name:`motivation`,rows:3,placeholder:`Tell us why you'd like to join…`})})]})]})},_={name:`Tight gap (gap=3)`,args:{gap:3,legend:`Contact info`},render:e=>(0,f.jsxs)(d,{...e,children:[(0,f.jsx)(l,{label:`Phone`,htmlFor:`ph`,children:(0,f.jsx)(r,{id:`ph`,name:`phone`,type:`tel`,placeholder:`+31 6 1234 5678`})}),(0,f.jsx)(l,{label:`Website`,htmlFor:`web`,children:(0,f.jsx)(r,{id:`web`,name:`website`,type:`url`,placeholder:`https://yoursite.com`})})]})},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: args => <FormGroup {...args}>
      <FormField label="First name" htmlFor="fn">
        <Input id="fn" name="firstName" placeholder="Jane" />
      </FormField>
      <FormField label="Last name" htmlFor="ln">
        <Input id="ln" name="lastName" placeholder="Smith" />
      </FormField>
      <FormField label="Email address" htmlFor="em">
        <Input id="em" name="email" type="email" placeholder="jane@example.com" />
      </FormField>
    </FormGroup>
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "No legend (plain Stack)",
  args: {
    legend: ""
  },
  render: args => <FormGroup {...args}>
      <FormField label="Email address" htmlFor="em2">
        <Input id="em2" name="email" type="email" placeholder="you@example.com" />
      </FormField>
      <FormField label="Password" htmlFor="pw">
        <Input id="pw" name="password" type="password" />
      </FormField>
    </FormGroup>
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "Multi-section form",
  render: () => <form style={{
    display: "flex",
    flexDirection: "column",
    gap: "2rem"
  }}>
      <FormGroup legend="Personal details">
        <FormField label="Full name" htmlFor="ms-name" required>
          <Input id="ms-name" name="name" placeholder="Jane Smith" />
        </FormField>
        <FormField label="Email" htmlFor="ms-email" required>
          <Input id="ms-email" name="email" type="email" placeholder="jane@example.com" />
        </FormField>
      </FormGroup>

      <FormGroup legend="Work details">
        <FormField label="Department" htmlFor="ms-dept">
          <Select id="ms-dept" name="department">
            <option value="">Choose a department</option>
            <option value="eng">Engineering</option>
            <option value="design">Design</option>
            <option value="marketing">Marketing</option>
          </Select>
        </FormField>
        <FormField label="Motivation" htmlFor="ms-msg">
          <Textarea id="ms-msg" name="motivation" rows={3} placeholder="Tell us why you'd like to join…" />
        </FormField>
      </FormGroup>
    </form>
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "Tight gap (gap=3)",
  args: {
    gap: 3,
    legend: "Contact info"
  },
  render: args => <FormGroup {...args}>
      <FormField label="Phone" htmlFor="ph">
        <Input id="ph" name="phone" type="tel" placeholder="+31 6 1234 5678" />
      </FormField>
      <FormField label="Website" htmlFor="web">
        <Input id="web" name="website" type="url" placeholder="https://yoursite.com" />
      </FormField>
    </FormGroup>
}`,..._.parameters?.docs?.source}}},v=[`Default`,`NoLegend`,`MultiSection`,`TightGap`]}))();export{m as Default,g as MultiSection,h as NoLegend,_ as TightGap,v as __namedExportsOrder,p as default};