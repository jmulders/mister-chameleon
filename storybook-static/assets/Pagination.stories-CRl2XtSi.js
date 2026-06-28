import{n as e,o as t}from"./chunk-vNrZSFDR.js";import{M as n,rt as r}from"./iframe-BPplKtwB.js";import{n as i,t as a}from"./Pagination-DGlxEX1F.js";var o,s,c,l,u,d,f,p,m,h,g;e((()=>{o=n(),s=t(r()),i(),c=e=>(0,o.jsx)(s.Suspense,{fallback:(0,o.jsx)(`div`,{style:{height:`2.25rem`}}),children:(0,o.jsx)(e,{})}),l={title:`Molecules/Pagination`,component:a,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"URL-param-driven page controls (`?page=N`). Reads and writes the `page` search param via `useSearchParams` and `router.replace`. Must be wrapped in `<Suspense>` when used in a Server Component tree. Renders nothing when `totalPages ≤ 1`."}}},argTypes:{totalPages:{control:{type:`number`,min:1,max:50}},maxVisible:{control:{type:`number`,min:3,max:11}}},args:{totalPages:10,maxVisible:5},decorators:[c]},u={},d={name:`Few pages (no ellipsis)`,args:{totalPages:4}},f={name:`Many pages (15)`,args:{totalPages:15}},p={name:`Wide visible window (maxVisible=9)`,args:{totalPages:20,maxVisible:9}},m={name:`Two pages (minimum useful)`,args:{totalPages:2}},h={name:`Single page (renders nothing)`,args:{totalPages:1}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Few pages (no ellipsis)",
  args: {
    totalPages: 4
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Many pages (15)",
  args: {
    totalPages: 15
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Wide visible window (maxVisible=9)",
  args: {
    totalPages: 20,
    maxVisible: 9
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "Two pages (minimum useful)",
  args: {
    totalPages: 2
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "Single page (renders nothing)",
  args: {
    totalPages: 1
  }
}`,...h.parameters?.docs?.source}}},g=[`Default`,`FewPages`,`ManyPages`,`WideWindow`,`TwoPages`,`SinglePage`]}))();export{u as Default,d as FewPages,f as ManyPages,h as SinglePage,m as TwoPages,p as WideWindow,g as __namedExportsOrder,l as default};