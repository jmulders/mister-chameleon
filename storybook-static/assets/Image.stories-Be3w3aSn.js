import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Image-B8zwps6-.js";var i,a,o,s,c,l,u,d,f,p,m,h;e((()=>{i=t(),n(),a=`https://picsum.photos/seed/chameleon1/800/450`,o=`https://picsum.photos/seed/chameleon2/600/800`,s=`https://picsum.photos/seed/chameleon3/600/600`,c={title:`Atoms/Image`,component:r,tags:[`autodocs`],parameters:{docs:{description:{component:"CMS-friendly responsive image atom. Renders a standard `<img>` with lazy loading. Use `aspectRatio` to prevent layout shift. Falls back to a placeholder div when `src` is absent."}}},argTypes:{aspectRatio:{control:`select`,options:[`auto`,`video`,`square`,`portrait`,`wide`]},fit:{control:`select`,options:[`cover`,`contain`,`fill`]},rounded:{control:`select`,options:[!1,!0,`sm`,`md`,`lg`,`xl`,`full`]},loading:{control:`select`,options:[`lazy`,`eager`]}},args:{src:a,alt:`Sample landscape image`,aspectRatio:`video`},decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:`40rem`},children:(0,i.jsx)(e,{})})]},l={},u={name:`Aspect ratio variants`,render:()=>(0,i.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`1.5rem`,maxWidth:`32rem`},children:[`video`,`wide`,`square`,`portrait`].map(e=>(0,i.jsxs)(`div`,{children:[(0,i.jsxs)(`p`,{style:{fontSize:`0.75rem`,color:`var(--text-muted)`,marginBottom:`0.5rem`},children:[`aspectRatio="`,e,`"`]}),(0,i.jsx)(r,{src:a,alt:`${e} example`,aspectRatio:e,rounded:`md`})]},e))})},d={name:`Placeholder (no src)`,args:{src:void 0,alt:`Missing image`,aspectRatio:`video`}},f={name:`Rounded variants`,render:()=>(0,i.jsx)(`div`,{style:{display:`flex`,gap:`1rem`,flexWrap:`wrap`},children:[`sm`,`md`,`lg`,`xl`,`full`].map(e=>(0,i.jsxs)(`div`,{style:{width:`8rem`},children:[(0,i.jsx)(r,{src:s,alt:e,aspectRatio:`square`,rounded:e}),(0,i.jsx)(`p`,{style:{fontSize:`0.75rem`,color:`var(--text-muted)`,textAlign:`center`,marginTop:`0.25rem`},children:e})]},e))})},p={name:`Portrait aspect ratio`,args:{src:o,alt:`Portrait image`,aspectRatio:`portrait`,rounded:`lg`}},m={name:`Object fit: contain`,args:{src:a,alt:`Contain`,aspectRatio:`square`,fit:`contain`,rounded:`md`}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Aspect ratio variants",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    maxWidth: "32rem"
  }}>
      {(["video", "wide", "square", "portrait"] as const).map(ratio => <div key={ratio}>
          <p style={{
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        marginBottom: "0.5rem"
      }}>
            aspectRatio=&quot;{ratio}&quot;
          </p>
          <Image src={LANDSCAPE} alt={\`\${ratio} example\`} aspectRatio={ratio} rounded="md" />
        </div>)}
    </div>
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Placeholder (no src)",
  args: {
    src: undefined,
    alt: "Missing image",
    aspectRatio: "video"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Rounded variants",
  render: () => <div style={{
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap"
  }}>
      {(["sm", "md", "lg", "xl", "full"] as const).map(r => <div key={r} style={{
      width: "8rem"
    }}>
          <Image src={SQUARE} alt={r} aspectRatio="square" rounded={r} />
          <p style={{
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        textAlign: "center",
        marginTop: "0.25rem"
      }}>
            {r}
          </p>
        </div>)}
    </div>
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Portrait aspect ratio",
  args: {
    src: PORTRAIT,
    alt: "Portrait image",
    aspectRatio: "portrait",
    rounded: "lg"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "Object fit: contain",
  args: {
    src: LANDSCAPE,
    alt: "Contain",
    aspectRatio: "square",
    fit: "contain",
    rounded: "md"
  }
}`,...m.parameters?.docs?.source}}},h=[`Default`,`AspectRatios`,`Placeholder`,`Rounded`,`Portrait`,`ObjectContain`]}))();export{u as AspectRatios,l as Default,m as ObjectContain,d as Placeholder,p as Portrait,f as Rounded,h as __namedExportsOrder,c as default};