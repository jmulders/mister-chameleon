import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./utils-DTREARv9.js";import{n as i,t as a}from"./Button-CxkYI-eU.js";function o({children:e,className:t,as:n=`div`,padding:i=`md`,shadow:a=`sm`,hover:o=!1}){return(0,u.jsx)(n,{className:r(`rounded-[var(--card-radius,0.75rem)] border border-[var(--border,#e5e7eb)] bg-[var(--card-bg,#ffffff)]`,d[i],f[a],o&&`transition-shadow duration-200 hover:shadow-md cursor-pointer`,t),children:e})}function s({children:e,className:t}){return(0,u.jsx)(`div`,{className:r(`flex flex-col gap-1.5 pb-4`,t),children:e})}function c({children:e,className:t}){return(0,u.jsx)(`div`,{className:r(``,t),children:e})}function l({children:e,className:t}){return(0,u.jsx)(`div`,{className:r(`flex items-center pt-4`,t),children:e})}var u,d,f,p=e((()=>{u=t(),n(),d={none:``,sm:`p-4`,md:`p-6`,lg:`p-8`},f={none:``,sm:`shadow-sm`,md:`shadow-md`},o.__docgenInfo={description:``,methods:[],displayName:`Card`,props:{children:{required:!0,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},className:{required:!1,tsType:{name:`string`},description:``},as:{required:!1,tsType:{name:`ReactElementType`,raw:`React.ElementType`},description:``,defaultValue:{value:`"div"`,computed:!1}},padding:{required:!1,tsType:{name:`union`,raw:`"none" | "sm" | "md" | "lg"`,elements:[{name:`literal`,value:`"none"`},{name:`literal`,value:`"sm"`},{name:`literal`,value:`"md"`},{name:`literal`,value:`"lg"`}]},description:``,defaultValue:{value:`"md"`,computed:!1}},shadow:{required:!1,tsType:{name:`union`,raw:`"none" | "sm" | "md"`,elements:[{name:`literal`,value:`"none"`},{name:`literal`,value:`"sm"`},{name:`literal`,value:`"md"`}]},description:``,defaultValue:{value:`"sm"`,computed:!1}},hover:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}}}},s.__docgenInfo={description:``,methods:[],displayName:`CardHeader`,props:{children:{required:!0,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},className:{required:!1,tsType:{name:`string`},description:``}}},c.__docgenInfo={description:``,methods:[],displayName:`CardContent`,props:{children:{required:!0,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},className:{required:!1,tsType:{name:`string`},description:``}}},l.__docgenInfo={description:``,methods:[],displayName:`CardFooter`,props:{children:{required:!0,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},className:{required:!1,tsType:{name:`string`},description:``}}}})),m,h,g,_,v,y,b,x,S;e((()=>{m=t(),p(),i(),h={title:`Atoms/Card`,component:o,tags:[`autodocs`],parameters:{docs:{description:{component:"Surface container with border, optional shadow, and padding. Compose with `CardHeader`, `CardContent`, and `CardFooter` for structured layouts, or use `Card` alone with children for simpler cases."}}},argTypes:{padding:{control:`select`,options:[`none`,`sm`,`md`,`lg`]},shadow:{control:`select`,options:[`none`,`sm`,`md`]},hover:{control:`boolean`}},args:{padding:`md`,shadow:`sm`,hover:!1},decorators:[e=>(0,m.jsx)(`div`,{style:{maxWidth:`24rem`},children:(0,m.jsx)(e,{})})]},g={render:e=>(0,m.jsx)(o,{...e,children:(0,m.jsx)(`p`,{style:{fontSize:`0.875rem`},children:`Simple card content — no sub-components needed for basic use.`})})},_={name:`Structured (Header + Content + Footer)`,render:()=>(0,m.jsxs)(o,{children:[(0,m.jsxs)(s,{children:[(0,m.jsx)(`h3`,{style:{fontWeight:600,fontSize:`1rem`},children:`Card title`}),(0,m.jsx)(`p`,{style:{fontSize:`0.875rem`,color:`var(--text-muted, #6b7280)`},children:`Supporting description`})]}),(0,m.jsx)(c,{children:(0,m.jsx)(`p`,{style:{fontSize:`0.875rem`},children:`Main content area. Add any text, media, or components here.`})}),(0,m.jsxs)(l,{children:[(0,m.jsx)(a,{size:`sm`,variant:`primary`,children:`Action`}),(0,m.jsx)(a,{size:`sm`,variant:`ghost`,style:{marginLeft:`0.5rem`},children:`Cancel`})]})]})},v={name:`Hover effect`,args:{hover:!0},render:e=>(0,m.jsx)(o,{...e,children:(0,m.jsx)(`p`,{style:{fontSize:`0.875rem`},children:`Hover over this card to see the shadow lift.`})})},y={name:`Shadow variants`,render:()=>(0,m.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`1rem`},children:[`none`,`sm`,`md`].map(e=>(0,m.jsx)(o,{shadow:e,children:(0,m.jsxs)(`p`,{style:{fontSize:`0.875rem`},children:[`shadow="`,e,`"`]})},e))})},b={name:`Padding variants`,render:()=>(0,m.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`1rem`},children:[`none`,`sm`,`md`,`lg`].map(e=>(0,m.jsx)(o,{padding:e,children:(0,m.jsxs)(`p`,{style:{fontSize:`0.875rem`},children:[`padding="`,e,`"`]})},e))})},x={name:`Grid of cards`,render:()=>(0,m.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(3, 1fr)`,gap:`1.5rem`,maxWidth:`56rem`},children:[{title:`Analytics`,desc:`Real-time dashboards and insights.`},{title:`Integrations`,desc:`Connect your favourite tools.`},{title:`Security`,desc:`Enterprise-grade data protection.`}].map(({title:e,desc:t})=>(0,m.jsxs)(o,{hover:!0,children:[(0,m.jsx)(s,{children:(0,m.jsx)(`h3`,{style:{fontWeight:600},children:e})}),(0,m.jsx)(c,{children:(0,m.jsx)(`p`,{style:{fontSize:`0.875rem`,color:`var(--text-muted, #6b7280)`},children:t})})]},e))})},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: args => <Card {...args}>
      <p style={{
      fontSize: "0.875rem"
    }}>Simple card content — no sub-components needed for basic use.</p>
    </Card>
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "Structured (Header + Content + Footer)",
  render: () => <Card>
      <CardHeader>
        <h3 style={{
        fontWeight: 600,
        fontSize: "1rem"
      }}>Card title</h3>
        <p style={{
        fontSize: "0.875rem",
        color: "var(--text-muted, #6b7280)"
      }}>
          Supporting description
        </p>
      </CardHeader>
      <CardContent>
        <p style={{
        fontSize: "0.875rem"
      }}>
          Main content area. Add any text, media, or components here.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="primary">Action</Button>
        <Button size="sm" variant="ghost" style={{
        marginLeft: "0.5rem"
      }}>Cancel</Button>
      </CardFooter>
    </Card>
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "Hover effect",
  args: {
    hover: true
  },
  render: args => <Card {...args}>
      <p style={{
      fontSize: "0.875rem"
    }}>Hover over this card to see the shadow lift.</p>
    </Card>
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "Shadow variants",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "1rem"
  }}>
      {(["none", "sm", "md"] as const).map(shadow => <Card key={shadow} shadow={shadow}>
          <p style={{
        fontSize: "0.875rem"
      }}>shadow=&quot;{shadow}&quot;</p>
        </Card>)}
    </div>
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "Padding variants",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "1rem"
  }}>
      {(["none", "sm", "md", "lg"] as const).map(padding => <Card key={padding} padding={padding}>
          <p style={{
        fontSize: "0.875rem"
      }}>padding=&quot;{padding}&quot;</p>
        </Card>)}
    </div>
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "Grid of cards",
  render: () => <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1.5rem",
    maxWidth: "56rem"
  }}>
      {[{
      title: "Analytics",
      desc: "Real-time dashboards and insights."
    }, {
      title: "Integrations",
      desc: "Connect your favourite tools."
    }, {
      title: "Security",
      desc: "Enterprise-grade data protection."
    }].map(({
      title,
      desc
    }) => <Card key={title} hover>
          <CardHeader>
            <h3 style={{
          fontWeight: 600
        }}>{title}</h3>
          </CardHeader>
          <CardContent>
            <p style={{
          fontSize: "0.875rem",
          color: "var(--text-muted, #6b7280)"
        }}>{desc}</p>
          </CardContent>
        </Card>)}
    </div>
}`,...x.parameters?.docs?.source}}},S=[`Default`,`Structured`,`HoverEffect`,`ShadowVariants`,`PaddingVariants`,`GridOfCards`]}))();export{g as Default,x as GridOfCards,v as HoverEffect,b as PaddingVariants,y as ShadowVariants,_ as Structured,S as __namedExportsOrder,h as default};