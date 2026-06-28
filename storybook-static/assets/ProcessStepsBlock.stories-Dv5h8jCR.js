import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./ProcessStepsBlock-8G-85qJq.js";var r,i,a,o,s,c,l,u,d,f;e((()=>{t(),r={heading:`Our hiring process`,steps:[...[{title:`Apply online`,description:`Submit your CV and a short cover note via our application form. We read every application personally.`,duration:`5 min`},{title:`Screening call`,description:`A 30-minute call with our recruiter to learn about your background and tell you more about the role and our culture.`,duration:`30 min`},{title:`Technical interview`,description:`A 60-minute session with two engineers. We focus on problem-solving and collaboration, not whiteboard puzzles.`,duration:`60 min`},{title:`Take-home challenge`,description:`A real-world task that mirrors the work you would do in this role. We scope it to 3–4 hours and pay you for your time.`,duration:`3–4 h`},{title:`Final interview`,description:`Meet the wider team, discuss your challenge, and ask us anything. We usually make an offer within 48 hours.`,duration:`90 min`}]]},i={title:`Blocks/Sections/ProcessSteps`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Ordered process steps section. Four variants: `default` (numbered vertical list), `accordion` (collapsible details), `compact` (tight numbered list), `horizontal` (step track with connecting line — ideal for 3–5 steps on landing pages)."}}}},a={name:`default — numbered vertical list with dividers`,args:{data:r,variant:`default`}},o={name:`accordion — collapsible steps (zero-JS)`,args:{data:r,variant:`accordion`}},s={name:`compact — tight numbered list`,args:{data:r,variant:`compact`}},c={name:`no section heading`,args:{data:{...r,heading:void 0},variant:`default`}},l={name:`horizontal — step track (landing page / AI product)`,args:{data:{heading:`Get set up in three steps`,steps:[{title:`Connect your data`,description:`Point us at your database, API, or CSV — we handle the rest.`,duration:`2 min`},{title:`Define your rules`,description:`Use our no-code rule builder or drop in your own SQL.`,duration:`5 min`},{title:`Go live`,description:`Publish your changes and start seeing results in real time.`,duration:`Instant`}]},variant:`horizontal`}},u={name:`horizontal — five steps (full hiring flow)`,args:{data:r,variant:`horizontal`}},d={name:`horizontal — mobile (375px, falls back to vertical)`,args:{data:{heading:`Get set up in three steps`,steps:[{title:`Connect your data`,description:`Point us at your source.`,duration:`2 min`},{title:`Define your rules`,description:`No-code rule builder.`,duration:`5 min`},{title:`Go live`,description:`Publish and see results.`,duration:`Instant`}]},variant:`horizontal`},parameters:{viewport:{defaultViewport:`mobile`}}},a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  name: "default — numbered vertical list with dividers",
  args: {
    data: base,
    variant: "default"
  }
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  name: "accordion — collapsible steps (zero-JS)",
  args: {
    data: base,
    variant: "accordion"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "compact — tight numbered list",
  args: {
    data: base,
    variant: "compact"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "no section heading",
  args: {
    data: {
      ...base,
      heading: undefined
    },
    variant: "default"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "horizontal — step track (landing page / AI product)",
  args: {
    data: {
      heading: "Get set up in three steps",
      steps: [{
        title: "Connect your data",
        description: "Point us at your database, API, or CSV — we handle the rest.",
        duration: "2 min"
      }, {
        title: "Define your rules",
        description: "Use our no-code rule builder or drop in your own SQL.",
        duration: "5 min"
      }, {
        title: "Go live",
        description: "Publish your changes and start seeing results in real time.",
        duration: "Instant"
      }]
    },
    variant: "horizontal"
  }
}`,...l.parameters?.docs?.source},description:{story:`horizontal — step track with numbered nodes connected by a horizontal line.
Best for short 3–5 step flows; on mobile it falls back to the vertical list.`,...l.parameters?.docs?.description}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "horizontal — five steps (full hiring flow)",
  args: {
    data: base,
    variant: "horizontal"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "horizontal — mobile (375px, falls back to vertical)",
  args: {
    data: {
      heading: "Get set up in three steps",
      steps: [{
        title: "Connect your data",
        description: "Point us at your source.",
        duration: "2 min"
      }, {
        title: "Define your rules",
        description: "No-code rule builder.",
        duration: "5 min"
      }, {
        title: "Go live",
        description: "Publish and see results.",
        duration: "Instant"
      }]
    },
    variant: "horizontal"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...d.parameters?.docs?.source}}},f=[`Default`,`Accordion`,`Compact`,`NoHeading`,`Horizontal`,`HorizontalFiveSteps`,`HorizontalMobile`]}))();export{o as Accordion,s as Compact,a as Default,l as Horizontal,u as HorizontalFiveSteps,d as HorizontalMobile,c as NoHeading,f as __namedExportsOrder,i as default};