import{n as e,o as t}from"./chunk-vNrZSFDR.js";import{I as n,M as r,P as i,rt as a}from"./iframe-BPplKtwB.js";import{n as o,t as s}from"./utils-DTREARv9.js";function c(){return(0,u.jsxs)(`svg`,{"aria-hidden":`true`,viewBox:`0 0 20 20`,fill:`none`,stroke:`currentColor`,strokeWidth:1.75,className:`size-4 shrink-0`,children:[(0,u.jsx)(`circle`,{cx:`8.5`,cy:`8.5`,r:`5.5`}),(0,u.jsx)(`path`,{strokeLinecap:`round`,d:`m13.5 13.5 3.5 3.5`})]})}function l({searchHref:e=`/search`,placeholder:t=`Search…`,className:r}){let[i,a]=(0,d.useState)(``),[o,l]=(0,d.useState)(!1),f=(0,d.useRef)(null),p=n();function m(t){t.preventDefault();let n=i.trim();if(!n){f.current?.focus();return}let r=typeof e==`string`&&e?e:`/search`;p.push(`${r}?q=${encodeURIComponent(n)}`)}return(0,u.jsx)(`form`,{role:`search`,onSubmit:m,className:s(`flex items-center`,r),children:(0,u.jsxs)(`div`,{className:s(`flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-150`,`border-[var(--header-border,var(--border))]`,`bg-[var(--header-input-bg,var(--bg-subtle,var(--bg)))]`,o?`ring-2 ring-[var(--ring)] ring-offset-1 border-transparent`:`hover:border-[var(--primary,var(--ring))]`),children:[(0,u.jsx)(`button`,{type:`submit`,"aria-label":`Search`,className:s(`shrink-0 transition-colors`,`text-[var(--text-muted)] hover:text-[var(--text-brand,var(--primary))]`,`focus-visible:outline-none`),children:(0,u.jsx)(c,{})}),(0,u.jsx)(`input`,{ref:f,type:`search`,name:`q`,value:i,onChange:e=>a(e.target.value),onFocus:()=>l(!0),onBlur:()=>l(!1),placeholder:t,autoComplete:`off`,className:s(`w-56 min-w-0 bg-transparent text-sm outline-none`,`text-[var(--header-fg,var(--text))]`,`placeholder:text-[var(--text-muted)]`,`transition-[width] duration-200 focus:w-72`)})]})})}var u,d,f=e((()=>{u=r(),d=t(a()),i(),o(),l.__docgenInfo={description:``,methods:[],displayName:`SearchBar`,props:{searchHref:{required:!1,tsType:{name:`string`},description:`Path of the search results page. Defaults to "/search".`,defaultValue:{value:`"/search"`,computed:!1}},placeholder:{required:!1,tsType:{name:`string`},description:`Placeholder text inside the input.`,defaultValue:{value:`"Search…"`,computed:!1}},className:{required:!1,tsType:{name:`string`},description:``}}}}));function p({children:e}){return(0,m.jsx)(`div`,{style:{background:`var(--header-bg, var(--bg, #fff))`,padding:`0.75rem 1.5rem`,display:`flex`,alignItems:`center`,borderBottom:`1px solid var(--border, #e5e7eb)`,minHeight:56},children:e})}var m,h,g,_,v,y,b;e((()=>{m=r(),f(),h={title:`Layout/SearchBar`,component:l,tags:[`autodocs`],parameters:{docs:{description:{component:"Compact search input for the triband header. Expands from `w-56` to `w-72` on focus. Navigates to `searchHref?q=<value>` on submit. Styled exclusively via CSS custom properties — no hardcoded colours."}}},argTypes:{placeholder:{control:`text`},searchHref:{control:`text`},className:{control:`text`}}},g={name:`default`,args:{placeholder:`Zoeken…`,searchHref:`/search`},decorators:[e=>(0,m.jsx)(p,{children:(0,m.jsx)(e,{})})],parameters:{layout:`fullscreen`}},_={name:`English placeholder`,args:{placeholder:`Search…`,searchHref:`/search`},decorators:[e=>(0,m.jsx)(p,{children:(0,m.jsx)(e,{})})],parameters:{layout:`fullscreen`}},v={name:`dark header background`,args:{placeholder:`Zoeken…`,searchHref:`/search`},decorators:[e=>(0,m.jsx)(`div`,{style:{"--header-bg":`var(--primary, #1e2761)`,"--header-fg":`#ffffff`,"--header-border":`rgba(255,255,255,0.2)`,"--header-input-bg":`rgba(255,255,255,0.1)`,"--text-muted":`rgba(255,255,255,0.6)`,"--ring":`#ffffff`},children:(0,m.jsx)(p,{children:(0,m.jsx)(e,{})})})],parameters:{layout:`fullscreen`}},y={name:`standalone`,args:{placeholder:`Zoek vacatures, artikelen, pagina's…`,searchHref:`/search`,className:`w-full`},parameters:{layout:`padded`},decorators:[e=>(0,m.jsx)(`div`,{style:{maxWidth:480},children:(0,m.jsx)(e,{})})]},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "default",
  args: {
    placeholder: "Zoeken…",
    searchHref: "/search"
  },
  decorators: [Story => <HeaderWrapper><Story /></HeaderWrapper>],
  parameters: {
    layout: "fullscreen"
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "English placeholder",
  args: {
    placeholder: "Search…",
    searchHref: "/search"
  },
  decorators: [Story => <HeaderWrapper><Story /></HeaderWrapper>],
  parameters: {
    layout: "fullscreen"
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "dark header background",
  args: {
    placeholder: "Zoeken…",
    searchHref: "/search"
  },
  decorators: [Story => <div style={{
    "--header-bg": "var(--primary, #1e2761)",
    "--header-fg": "#ffffff",
    "--header-border": "rgba(255,255,255,0.2)",
    "--header-input-bg": "rgba(255,255,255,0.1)",
    "--text-muted": "rgba(255,255,255,0.6)",
    "--ring": "#ffffff"
  } as React.CSSProperties}>
        <HeaderWrapper><Story /></HeaderWrapper>
      </div>],
  parameters: {
    layout: "fullscreen"
  }
}`,...v.parameters?.docs?.source},description:{story:"On a dark header background (`--header-bg` override).\nDemonstrates that the bar picks up the token correctly.",...v.parameters?.docs?.description}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "standalone",
  args: {
    placeholder: "Zoek vacatures, artikelen, pagina's…",
    searchHref: "/search",
    className: "w-full"
  },
  parameters: {
    layout: "padded"
  },
  decorators: [Story => <div style={{
    maxWidth: 480
  }}>
        <Story />
      </div>]
}`,...y.parameters?.docs?.source},description:{story:`Standalone (no header wrapper) — shows just the control.
Useful for embedding in other layouts such as a hero.`,...y.parameters?.docs?.description}}},b=[`Default`,`EnglishPlaceholder`,`DarkHeader`,`Standalone`]}))();export{v as DarkHeader,g as Default,_ as EnglishPlaceholder,y as Standalone,b as __namedExportsOrder,h as default};