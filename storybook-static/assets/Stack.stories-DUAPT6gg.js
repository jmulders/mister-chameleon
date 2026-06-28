import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Stack-BQGne2u8.js";var i,a,o,s,c,l,u,d,f,p,m;e((()=>{i=t(),n(),a={title:`Atoms/Stack`,component:r,tags:[`autodocs`],parameters:{docs:{description:{component:`One-dimensional flex container — column by default, or row. Controls direction, gap, alignment, and wrapping via props. Used as the primary layout primitive throughout all molecules and blocks.`}}},argTypes:{direction:{control:`select`,options:[`col`,`row`]},gap:{control:`select`,options:[0,1,2,3,4,5,6,8,10,12,16,`px`]},align:{control:`select`,options:[`start`,`center`,`end`,`stretch`,`baseline`]},justify:{control:`select`,options:[`start`,`center`,`end`,`between`,`around`,`evenly`]},wrap:{control:`boolean`}},args:{direction:`col`,gap:4,wrap:!1}},o=({label:e,width:t=`auto`})=>(0,i.jsx)(`div`,{style:{background:`var(--primary, #6366f1)`,color:`#fff`,padding:`0.5rem 1rem`,borderRadius:`0.375rem`,fontSize:`0.875rem`,fontWeight:500,width:t,textAlign:`center`},children:e}),s={name:`Column (default)`,render:()=>(0,i.jsxs)(r,{direction:`col`,gap:3,children:[(0,i.jsx)(o,{label:`Item 1`}),(0,i.jsx)(o,{label:`Item 2`}),(0,i.jsx)(o,{label:`Item 3`})]})},c={render:()=>(0,i.jsxs)(r,{direction:`row`,gap:3,children:[(0,i.jsx)(o,{label:`Item 1`}),(0,i.jsx)(o,{label:`Item 2`}),(0,i.jsx)(o,{label:`Item 3`})]})},l={name:`Gap variants`,render:()=>(0,i.jsx)(r,{direction:`col`,gap:8,children:[0,2,4,6,8,12].map(e=>(0,i.jsxs)(`div`,{children:[(0,i.jsxs)(`p`,{style:{fontSize:`0.75rem`,color:`var(--text-muted)`,marginBottom:`0.5rem`},children:[`gap=`,e]}),(0,i.jsxs)(r,{direction:`row`,gap:e,children:[(0,i.jsx)(o,{label:`A`}),(0,i.jsx)(o,{label:`B`}),(0,i.jsx)(o,{label:`C`})]})]},e))})},u={name:`Cross-axis alignment`,render:()=>(0,i.jsx)(r,{direction:`col`,gap:6,children:[`start`,`center`,`end`].map(e=>(0,i.jsxs)(`div`,{children:[(0,i.jsxs)(`p`,{style:{fontSize:`0.75rem`,color:`var(--text-muted)`,marginBottom:`0.5rem`},children:[`align="`,e,`"`]}),(0,i.jsxs)(r,{direction:`row`,gap:3,align:e,style:{background:`var(--subtle, #f8fafc)`,padding:`0.75rem`,borderRadius:`0.5rem`},children:[(0,i.jsx)(o,{label:`Short`}),(0,i.jsx)(o,{label:`Taller item`,width:`6rem`}),(0,i.jsx)(o,{label:`Item`})]})]},e))})},d={name:`Main-axis justify`,render:()=>(0,i.jsx)(r,{direction:`col`,gap:6,children:[`start`,`center`,`end`,`between`].map(e=>(0,i.jsxs)(`div`,{children:[(0,i.jsxs)(`p`,{style:{fontSize:`0.75rem`,color:`var(--text-muted)`,marginBottom:`0.5rem`},children:[`justify="`,e,`"`]}),(0,i.jsxs)(r,{direction:`row`,gap:3,justify:e,style:{background:`var(--subtle, #f8fafc)`,padding:`0.75rem`,borderRadius:`0.5rem`},children:[(0,i.jsx)(o,{label:`A`}),(0,i.jsx)(o,{label:`B`}),(0,i.jsx)(o,{label:`C`})]})]},e))})},f={name:`Flex wrap`,render:()=>(0,i.jsx)(r,{direction:`row`,gap:3,wrap:!0,style:{maxWidth:`20rem`},children:[`Alpha`,`Beta`,`Gamma`,`Delta`,`Epsilon`,`Zeta`,`Eta`].map(e=>(0,i.jsx)(o,{label:e},e))})},p={name:`Semantic element (as=ul)`,render:()=>(0,i.jsxs)(r,{as:`ul`,direction:`col`,gap:2,style:{listStyle:`none`,padding:0,margin:0},children:[(0,i.jsx)(`li`,{children:(0,i.jsx)(o,{label:`List item 1`})}),(0,i.jsx)(`li`,{children:(0,i.jsx)(o,{label:`List item 2`})}),(0,i.jsx)(`li`,{children:(0,i.jsx)(o,{label:`List item 3`})})]})},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "Column (default)",
  render: () => <Stack direction="col" gap={3}>
      <Tile label="Item 1" />
      <Tile label="Item 2" />
      <Tile label="Item 3" />
    </Stack>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <Stack direction="row" gap={3}>
      <Tile label="Item 1" />
      <Tile label="Item 2" />
      <Tile label="Item 3" />
    </Stack>
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "Gap variants",
  render: () => <Stack direction="col" gap={8}>
      {([0, 2, 4, 6, 8, 12] as const).map(gap => <div key={gap}>
          <p style={{
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        marginBottom: "0.5rem"
      }}>
            gap={gap}
          </p>
          <Stack direction="row" gap={gap}>
            <Tile label="A" />
            <Tile label="B" />
            <Tile label="C" />
          </Stack>
        </div>)}
    </Stack>
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Cross-axis alignment",
  render: () => <Stack direction="col" gap={6}>
      {(["start", "center", "end"] as const).map(align => <div key={align}>
          <p style={{
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        marginBottom: "0.5rem"
      }}>
            align=&quot;{align}&quot;
          </p>
          <Stack direction="row" gap={3} align={align} style={{
        background: "var(--subtle, #f8fafc)",
        padding: "0.75rem",
        borderRadius: "0.5rem"
      }}>
            <Tile label="Short" />
            <Tile label="Taller item" width="6rem" />
            <Tile label="Item" />
          </Stack>
        </div>)}
    </Stack>
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Main-axis justify",
  render: () => <Stack direction="col" gap={6}>
      {(["start", "center", "end", "between"] as const).map(justify => <div key={justify}>
          <p style={{
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        marginBottom: "0.5rem"
      }}>
            justify=&quot;{justify}&quot;
          </p>
          <Stack direction="row" gap={3} justify={justify} style={{
        background: "var(--subtle, #f8fafc)",
        padding: "0.75rem",
        borderRadius: "0.5rem"
      }}>
            <Tile label="A" />
            <Tile label="B" />
            <Tile label="C" />
          </Stack>
        </div>)}
    </Stack>
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Flex wrap",
  render: () => <Stack direction="row" gap={3} wrap style={{
    maxWidth: "20rem"
  }}>
      {["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta"].map(label => <Tile key={label} label={label} />)}
    </Stack>
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Semantic element (as=ul)",
  render: () => <Stack as="ul" direction="col" gap={2} style={{
    listStyle: "none",
    padding: 0,
    margin: 0
  }}>
      <li><Tile label="List item 1" /></li>
      <li><Tile label="List item 2" /></li>
      <li><Tile label="List item 3" /></li>
    </Stack>
}`,...p.parameters?.docs?.source}}},m=[`Column`,`Row`,`GapVariants`,`Alignment`,`Justify`,`Wrapping`,`SemanticElement`]}))();export{u as Alignment,s as Column,l as GapVariants,d as Justify,c as Row,p as SemanticElement,f as Wrapping,m as __namedExportsOrder,a as default};