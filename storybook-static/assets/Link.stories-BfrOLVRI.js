import{n as e,o as t}from"./chunk-vNrZSFDR.js";import{M as n}from"./iframe-BPplKtwB.js";import{n as r,t as i}from"./utils-DTREARv9.js";import{t as a}from"./link-Dhuf_8VX.js";function o({href:e,children:t,className:n,variant:r=`default`,external:a=!1,...o}){let u=i(l[r],`cursor-pointer`,n),d=a?{target:`_blank`,rel:`noopener noreferrer`}:{};return a||e.startsWith(`http`)||e.startsWith(`mailto:`)?(0,s.jsx)(`a`,{href:e,className:u,...d,...o,children:t}):(0,s.jsx)(c.default,{href:e,className:u,...o,children:t})}var s,c,l,u=e((()=>{s=n(),c=t(a()),r(),l={default:`text-inherit hover:text-[var(--text-brand)] transition-colors duration-150`,primary:`text-[var(--text-brand)] hover:text-[var(--text-brand)] hover:opacity-80 transition-colors duration-150`,muted:`text-neutral-500 hover:text-neutral-700 transition-colors duration-150`,underline:`text-[var(--text-brand)] underline underline-offset-2 hover:opacity-80 transition-opacity duration-150`,nav:`text-neutral-700 hover:text-neutral-900 transition-colors duration-150`},o.__docgenInfo={description:``,methods:[],displayName:`Link`,props:{href:{required:!0,tsType:{name:`string`},description:``},children:{required:!0,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},className:{required:!1,tsType:{name:`string`},description:``},variant:{required:!1,tsType:{name:`union`,raw:`"default" | "primary" | "muted" | "underline" | "nav"`,elements:[{name:`literal`,value:`"default"`},{name:`literal`,value:`"primary"`},{name:`literal`,value:`"muted"`},{name:`literal`,value:`"underline"`},{name:`literal`,value:`"nav"`}]},description:``,defaultValue:{value:`"default"`,computed:!1}},external:{required:!1,tsType:{name:`boolean`},description:`Automatically adds rel="noopener noreferrer" and target="_blank"`,defaultValue:{value:`false`,computed:!1}}},composes:[`Omit`]}})),d,f,p,m,h,g,_,v;e((()=>{d=n(),u(),f={title:`Atoms/Link`,component:o,tags:[`autodocs`],parameters:{docs:{description:{component:"Styled anchor atom. Uses `next/link` for internal paths and a plain `<a>` for external URLs. Five variants: `default`, `primary`, `muted`, `underline`, `nav`."}}},argTypes:{variant:{control:`select`,options:[`default`,`primary`,`muted`,`underline`,`nav`]},external:{control:`boolean`}},args:{href:`/example`,children:`Example link`,variant:`default`}},p={},m={name:`All variants`,render:()=>(0,d.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`0.75rem`,padding:`1rem`},children:[`default`,`primary`,`muted`,`underline`,`nav`].map(e=>(0,d.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`1rem`},children:[(0,d.jsx)(`span`,{style:{width:`6rem`,fontSize:`0.75rem`,color:`var(--text-muted)`},children:e}),(0,d.jsxs)(o,{href:`/example`,variant:e,children:[`Link text — `,e]})]},e))})},h={name:`In prose context`,render:()=>(0,d.jsxs)(`p`,{style:{fontSize:`1rem`,lineHeight:`1.7`,maxWidth:`36rem`},children:[`This paragraph contains an`,` `,(0,d.jsx)(o,{href:`/example`,variant:`underline`,children:`inline link with underline variant`}),` `,`which is best suited for use within body copy where the link should be clearly distinguishable from surrounding text.`]})},g={name:`Nav links`,render:()=>(0,d.jsx)(`nav`,{style:{display:`flex`,gap:`1.5rem`,padding:`1rem`,background:`white`,borderBottom:`1px solid #e5e7eb`},children:[`Home`,`Products`,`Pricing`,`Blog`,`Contact`].map(e=>(0,d.jsx)(o,{href:`/example`,variant:`nav`,children:e},e))})},_={name:`External link`,args:{href:`https://example.com`,children:`Visit example.com`,variant:`primary`,external:!0}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "All variants",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "1rem"
  }}>
      {(["default", "primary", "muted", "underline", "nav"] as const).map(variant => <div key={variant} style={{
      display: "flex",
      alignItems: "center",
      gap: "1rem"
    }}>
          <span style={{
        width: "6rem",
        fontSize: "0.75rem",
        color: "var(--text-muted)"
      }}>{variant}</span>
          <Link href="/example" variant={variant}>
            Link text — {variant}
          </Link>
        </div>)}
    </div>
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "In prose context",
  render: () => <p style={{
    fontSize: "1rem",
    lineHeight: "1.7",
    maxWidth: "36rem"
  }}>
      This paragraph contains an{" "}
      <Link href="/example" variant="underline">
        inline link with underline variant
      </Link>{" "}
      which is best suited for use within body copy where the link should be clearly
      distinguishable from surrounding text.
    </p>
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "Nav links",
  render: () => <nav style={{
    display: "flex",
    gap: "1.5rem",
    padding: "1rem",
    background: "white",
    borderBottom: "1px solid #e5e7eb"
  }}>
      {["Home", "Products", "Pricing", "Blog", "Contact"].map(label => <Link key={label} href="/example" variant="nav">
          {label}
        </Link>)}
    </nav>
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "External link",
  args: {
    href: "https://example.com",
    children: "Visit example.com",
    variant: "primary",
    external: true
  }
}`,..._.parameters?.docs?.source}}},v=[`Default`,`AllVariants`,`InProse`,`NavLinks`,`ExternalLink`]}))();export{m as AllVariants,p as Default,_ as ExternalLink,h as InProse,g as NavLinks,v as __namedExportsOrder,f as default};