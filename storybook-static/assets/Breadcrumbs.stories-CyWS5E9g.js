import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./Breadcrumbs-CDNnD8P1.js";var r,i,a,o,s,c,l,u,d,f,p;e((()=>{t(),r=[{label:`Home`,href:`/`},{label:`About`}],i=[{label:`Home`,href:`/`},{label:`Blog`,href:`/blog`},{label:`Article title`}],a=[{label:`Home`,href:`/`},{label:`Careers`,href:`/careers`},{label:`Engineering`,href:`/careers/engineering`},{label:`Senior Frontend Developer`}],o={title:`Molecules/Breadcrumbs`,component:n,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:'Accessible navigation trail (`<nav aria-label="Breadcrumb">`). Last item is the current page (`aria-current="page"`). Includes JSON-LD `BreadcrumbList` structured data for SEO.'}}},args:{items:i}},s={},c={name:`Two levels`,args:{items:r}},l={name:`Three levels`,args:{items:i}},u={name:`Deep trail (4 levels)`,args:{items:a}},d={name:`Single item (home page)`,args:{items:[{label:`Home`}]}},f={name:`No links (breadcrumb text only)`,args:{items:[{label:`Section`},{label:`Sub-section`},{label:`Current page`}]}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Two levels",
  args: {
    items: twoLevel
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "Three levels",
  args: {
    items: threeLevel
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Deep trail (4 levels)",
  args: {
    items: deepTrail
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Single item (home page)",
  args: {
    items: [{
      label: "Home"
    }]
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "No links (breadcrumb text only)",
  args: {
    items: [{
      label: "Section"
    }, {
      label: "Sub-section"
    }, {
      label: "Current page"
    }]
  }
}`,...f.parameters?.docs?.source}}},p=[`Default`,`TwoLevels`,`ThreeLevels`,`DeepTrail`,`SingleItem`,`NoHrefs`]}))();export{u as DeepTrail,s as Default,f as NoHrefs,d as SingleItem,l as ThreeLevels,c as TwoLevels,p as __namedExportsOrder,o as default};