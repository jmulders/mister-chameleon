import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./LogoStripBlock-C0rPV0fp.js";var r,i,a,o,s,c,l,u,d,f,p,m;e((()=>{t(),r=[{name:`Acme Corp`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Acme`,url:`#`},{name:`Globex`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Globex`,url:`#`},{name:`Initech`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Initech`,url:`#`},{name:`Umbrella`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Umbrella`},{name:`Stark`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Stark`,url:`#`},{name:`Wayne`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Wayne`},{name:`Oscorp`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Oscorp`,url:`#`},{name:`Weyland`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Weyland`},{name:`Soylent`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Soylent`,url:`#`},{name:`Vandelay`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Vandelay`},{name:`Bluth`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Bluth`,url:`#`},{name:`Dunder Miff`,src:`https://placehold.co/160x48/e2e8f0/94a3b8?text=Dunder`}],i={heading:`Trusted by teams worldwide`,logos:r.slice(0,6)},a={heading:`Our customers`,logos:r},o={logos:r.slice(0,5)},s={title:`Blocks/Sections/LogoStrip`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Client / partner / integration logo showcase. Three variants: `default` (horizontal flex strip, full contrast), `muted` (same strip at reduced opacity and greyscale — classic 'trusted by' treatment), `logo_grid` (multi-row CSS grid, ideal for 6–12+ logos)."}}}},c={name:`default — full contrast strip`,args:{data:i,variant:`default`}},l={name:`muted — greyscale reduced opacity`,args:{data:i,variant:`muted`}},u={name:`logo_grid — multi-row cloud (12 logos)`,args:{data:a,variant:`logo_grid`}},d={name:`No heading`,args:{data:o,variant:`default`}},f={name:`Muted, no heading`,args:{data:{logos:r.slice(0,5)},variant:`muted`}},p={name:`Three logos`,args:{data:{heading:`Backed by`,logos:r.slice(0,3)},variant:`default`}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "default — full contrast strip",
  args: {
    data: stripData,
    variant: "default"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "muted — greyscale reduced opacity",
  args: {
    data: stripData,
    variant: "muted"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "logo_grid — multi-row cloud (12 logos)",
  args: {
    data: gridData,
    variant: "logo_grid"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: noHeadingData,
    variant: "default"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Muted, no heading",
  args: {
    data: {
      logos: logos.slice(0, 5)
    },
    variant: "muted"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Three logos",
  args: {
    data: {
      heading: "Backed by",
      logos: logos.slice(0, 3)
    },
    variant: "default"
  }
}`,...p.parameters?.docs?.source}}},m=[`Default`,`Muted`,`Grid`,`NoHeading`,`MutedNoHeading`,`FewLogos`]}))();export{c as Default,p as FewLogos,u as Grid,l as Muted,f as MutedNoHeading,d as NoHeading,m as __namedExportsOrder,s as default};