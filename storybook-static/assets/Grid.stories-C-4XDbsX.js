import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Grid-nQzDC2-U.js";var i,a,o,s,c,l,u,d;e((()=>{i=t(),n(),a={title:`Atoms/Grid`,component:r,tags:[`autodocs`],parameters:{docs:{description:{component:"CSS-grid container with responsive column presets. Columns collapse to 1 on mobile. `cols` sets the target column count at md+ breakpoint."}}},argTypes:{cols:{control:`select`,options:[1,2,3,4]},gap:{control:`select`,options:[`sm`,`md`,`lg`,`xl`]}},args:{cols:3,gap:`md`}},o=({n:e})=>(0,i.jsxs)(`div`,{style:{background:`var(--primary, #6366f1)`,color:`#fff`,padding:`1.5rem`,borderRadius:`0.5rem`,fontWeight:500,textAlign:`center`},children:[`Cell `,e]}),s={name:`3-column (default)`,render:()=>(0,i.jsx)(r,{cols:3,gap:`md`,children:Array.from({length:6},(e,t)=>(0,i.jsx)(o,{n:t+1},t))})},c={name:`2-column`,render:()=>(0,i.jsx)(r,{cols:2,gap:`md`,children:Array.from({length:4},(e,t)=>(0,i.jsx)(o,{n:t+1},t))})},l={name:`4-column`,render:()=>(0,i.jsx)(r,{cols:4,gap:`sm`,children:Array.from({length:8},(e,t)=>(0,i.jsx)(o,{n:t+1},t))})},u={name:`Gap variants`,render:()=>(0,i.jsx)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`2rem`},children:[`sm`,`md`,`lg`,`xl`].map(e=>(0,i.jsxs)(`div`,{children:[(0,i.jsxs)(`p`,{style:{fontSize:`0.75rem`,color:`var(--text-muted)`,marginBottom:`0.5rem`},children:[`gap="`,e,`"`]}),(0,i.jsx)(r,{cols:3,gap:e,children:[1,2,3].map(e=>(0,i.jsx)(o,{n:e},e))})]},e))})},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "3-column (default)",
  render: () => <Grid cols={3} gap="md">
      {Array.from({
      length: 6
    }, (_, i) => <Cell key={i} n={i + 1} />)}
    </Grid>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "2-column",
  render: () => <Grid cols={2} gap="md">
      {Array.from({
      length: 4
    }, (_, i) => <Cell key={i} n={i + 1} />)}
    </Grid>
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "4-column",
  render: () => <Grid cols={4} gap="sm">
      {Array.from({
      length: 8
    }, (_, i) => <Cell key={i} n={i + 1} />)}
    </Grid>
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Gap variants",
  render: () => <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "2rem"
  }}>
      {(["sm", "md", "lg", "xl"] as const).map(gap => <div key={gap}>
          <p style={{
        fontSize: "0.75rem",
        color: "var(--text-muted)",
        marginBottom: "0.5rem"
      }}>
            gap=&quot;{gap}&quot;
          </p>
          <Grid cols={3} gap={gap}>
            {[1, 2, 3].map(n => <Cell key={n} n={n} />)}
          </Grid>
        </div>)}
    </div>
}`,...u.parameters?.docs?.source}}},d=[`ThreeCol`,`TwoCol`,`FourCol`,`GapVariants`]}))();export{l as FourCol,u as GapVariants,s as ThreeCol,c as TwoCol,d as __namedExportsOrder,a as default};