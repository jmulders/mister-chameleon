import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./StatsBlock-C0EvoHwy.js";var r,i,a,o,s,c,l,u,d,f,p,m;e((()=>{t(),r={heading:`The numbers that matter`,items:[{value:`98%`,label:`Customer satisfaction score`,suffix:``},{value:`2.4M`,label:`Requests processed daily`,suffix:``},{value:`140`,label:`Tenants on the platform`,suffix:`+`},{value:`4`,label:`Average pages per session`,prefix:`×`}]},i={heading:`At a glance`,items:[{value:`50`,label:`Countries reached`,suffix:`+`},{value:`99.9`,label:`Uptime SLA`,suffix:`%`},{value:`14`,label:`Day free trial`}]},a={title:`Blocks/Sections/Stats`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Key metrics block. Three variants: `default` (large bordered metric cards on subtle bg), `compact` (tight inline row with separator lines, no card backgrounds), and `dark` (near-black section with vivid brand-coloured values — Dark AI / enterprise family)."}}}},o={name:`Default (large cards)`,args:{data:r,variant:`default`}},s={name:`Compact (inline row)`,args:{data:r,variant:`compact`}},c={name:`Three metrics`,args:{data:i,variant:`default`}},l={name:`No heading`,args:{data:{items:r.items},variant:`default`}},u={name:`Compact, no heading`,args:{data:{items:r.items},variant:`compact`}},d={name:`dark — near-black section, vivid brand metrics`,args:{data:r,variant:`dark`}},f={name:`dark — three metrics`,args:{data:i,variant:`dark`}},p={name:`dark — no heading`,args:{data:{items:r.items},variant:`dark`}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  name: "Default (large cards)",
  args: {
    data: stats,
    variant: "default"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "Compact (inline row)",
  args: {
    data: stats,
    variant: "compact"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Three metrics",
  args: {
    data: threeStats,
    variant: "default"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: {
      items: stats.items
    },
    variant: "default"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Compact, no heading",
  args: {
    data: {
      items: stats.items
    },
    variant: "compact"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "dark — near-black section, vivid brand metrics",
  args: {
    data: stats,
    variant: "dark"
  }
}`,...d.parameters?.docs?.source},description:{story:`dark — near-black section with large brand-coloured metric values.
No card borders — colour contrast carries the visual weight.
Dark AI / enterprise family variant.`,...d.parameters?.docs?.description}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "dark — three metrics",
  args: {
    data: threeStats,
    variant: "dark"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "dark — no heading",
  args: {
    data: {
      items: stats.items
    },
    variant: "dark"
  }
}`,...p.parameters?.docs?.source}}},m=[`Default`,`Compact`,`ThreeStats`,`NoHeading`,`CompactNoHeading`,`Dark`,`DarkThreeStats`,`DarkNoHeading`]}))();export{s as Compact,u as CompactNoHeading,d as Dark,p as DarkNoHeading,f as DarkThreeStats,o as Default,l as NoHeading,c as ThreeStats,m as __namedExportsOrder,a as default};