import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";function n({data:e,variant:t}){return t===`quote-minimal`?(0,r.jsx)(`section`,{className:`py-10`,children:(0,r.jsx)(`div`,{className:`mx-auto max-w-3xl px-6`,children:(0,r.jsxs)(`blockquote`,{className:`border-l-4 pl-6`,style:{borderColor:`var(--primary, #18181b)`},children:[(0,r.jsxs)(`p`,{className:`text-xl font-medium italic leading-relaxed`,style:{color:`var(--section-text, #18181b)`},children:[`“`,e.quote,`”`]}),(e.attribution||e.source)&&(0,r.jsxs)(`footer`,{className:`mt-4 flex items-center gap-3`,children:[e.avatarUrl&&(0,r.jsx)(`img`,{src:e.avatarUrl,alt:e.attribution??``,className:`h-8 w-8 rounded-full object-cover`}),(0,r.jsxs)(`div`,{children:[e.attribution&&(0,r.jsx)(`span`,{className:`text-sm font-semibold`,style:{color:`var(--section-text, #18181b)`},children:e.attribution}),e.source&&(0,r.jsxs)(`span`,{className:`ml-1 text-sm`,style:{color:`var(--text-muted, #6b7280)`},children:[`· `,e.source]})]})]})]})})}):(0,r.jsx)(`section`,{className:`py-16`,children:(0,r.jsx)(`div`,{className:`mx-auto max-w-3xl px-6`,children:(0,r.jsxs)(`div`,{className:`relative rounded-2xl px-8 py-10`,style:{background:`var(--section-subtle-bg, #f9fafb)`},children:[(0,r.jsx)(`span`,{className:`absolute -top-4 left-6 text-7xl font-serif leading-none select-none`,style:{color:`var(--primary, #18181b)`,opacity:.15},"aria-hidden":`true`,children:`“`}),(0,r.jsxs)(`blockquote`,{className:`relative`,children:[(0,r.jsxs)(`p`,{className:`text-xl font-medium italic leading-relaxed text-[var(--foreground)]`,children:[`“`,e.quote,`”`]}),(e.attribution||e.source)&&(0,r.jsxs)(`footer`,{className:`mt-6 flex items-center gap-4`,children:[e.avatarUrl&&(0,r.jsx)(`img`,{src:e.avatarUrl,alt:e.attribution??``,className:`h-12 w-12 rounded-full object-cover flex-shrink-0`}),(0,r.jsxs)(`div`,{children:[e.attribution&&(0,r.jsx)(`p`,{className:`font-semibold text-[var(--foreground)]`,children:e.attribution}),e.source&&(0,r.jsx)(`p`,{className:`text-sm`,style:{color:`var(--text-muted, #6b7280)`},children:e.source})]})]})]})]})})})}var r,i=e((()=>{r=t(),n.__docgenInfo={description:``,methods:[],displayName:`QuoteBlock`,props:{data:{required:!0,tsType:{name:`QuoteBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),a,o,s,c,l,u,d;e((()=>{i(),a={quote:`The best investment we ever made. Personalisation at this scale was something we thought would take years to build.`,attribution:`Sophie van den Berg`,source:`Chief Marketing Officer, Groei B.V.`,avatarUrl:`https://i.pravatar.cc/80?img=47`},o={title:`Blocks/Sections/Quote`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"A single pull-quote with optional attribution, source, and avatar. Distinct from TestimonialSection — a Quote is one highlighted statement (analyst, founder, press) rather than a customer-review grid. Variants: `quote-card` (default), `quote-minimal`."}}}},s={name:`quote-card (default)`,args:{data:a,variant:`quote-card`}},c={name:`quote-minimal`,args:{data:a,variant:`quote-minimal`}},l={name:`No avatar`,args:{data:{...a,avatarUrl:void 0},variant:`quote-card`}},u={name:`Quote only (no attribution)`,args:{data:{quote:`Move fast, break nothing — that's personalisation done right.`},variant:`quote-card`}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "quote-card (default)",
  args: {
    data: baseData,
    variant: "quote-card"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "quote-minimal",
  args: {
    data: baseData,
    variant: "quote-minimal"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "No avatar",
  args: {
    data: {
      ...baseData,
      avatarUrl: undefined
    },
    variant: "quote-card"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Quote only (no attribution)",
  args: {
    data: {
      quote: "Move fast, break nothing — that's personalisation done right."
    },
    variant: "quote-card"
  }
}`,...u.parameters?.docs?.source}}},d=[`Card`,`Minimal`,`NoAvatar`,`QuoteOnly`]}))();export{s as Card,c as Minimal,l as NoAvatar,u as QuoteOnly,d as __namedExportsOrder,o as default};