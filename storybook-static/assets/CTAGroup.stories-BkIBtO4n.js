import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./CTAGroup-BVZ030vG.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y;e((()=>{i=t(),n(),a=[{label:`Get started`,href:`#`}],o=[{label:`Get started`,href:`#`},{label:`Learn more`,href:`#`}],s=[{label:`Primary`,href:`#`},{label:`Secondary`,href:`#`},{label:`Ghost`,href:`#`,variant:`ghost`}],c={title:`Molecules/CTAGroup`,component:r,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Renders a `BlockCTA[]` array as a horizontal flex-wrap row of Buttons. First CTA is primary, subsequent CTAs are outline by default. The `inverted` prop switches to a contrasting palette for use on brand or dark backgrounds."}}},argTypes:{size:{control:`select`,options:[`sm`,`md`,`lg`]},align:{control:`select`,options:[`start`,`center`,`end`]},inverted:{control:`boolean`}},args:{ctas:o,size:`md`,align:`start`,inverted:!1}},l={},u={name:`Single CTA`,args:{ctas:a}},d={name:`Three CTAs`,args:{ctas:s}},f={name:`Small size`,args:{size:`sm`}},p={name:`Large size`,args:{size:`lg`}},m={name:`Centre aligned`,args:{align:`center`}},h={name:`End aligned`,args:{align:`end`}},g={name:`Inverted (on brand background)`,args:{inverted:!0},decorators:[e=>(0,i.jsx)(`div`,{style:{background:`var(--primary, #6366f1)`,padding:`2rem`,borderRadius:`0.75rem`},children:(0,i.jsx)(e,{})})]},_={name:`Inverted (on dark background)`,args:{inverted:!0},decorators:[e=>(0,i.jsx)(`div`,{style:{background:`#0f172a`,padding:`2rem`,borderRadius:`0.75rem`},children:(0,i.jsx)(e,{})})]},v={name:`Empty array (renders nothing)`,args:{ctas:[]}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Single CTA",
  args: {
    ctas: primaryOnly
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Three CTAs",
  args: {
    ctas: threeButtons
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Small size",
  args: {
    size: "sm"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Large size",
  args: {
    size: "lg"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "Centre aligned",
  args: {
    align: "center"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "End aligned",
  args: {
    align: "end"
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "Inverted (on brand background)",
  args: {
    inverted: true
  },
  decorators: [Story => <div style={{
    background: "var(--primary, #6366f1)",
    padding: "2rem",
    borderRadius: "0.75rem"
  }}>
        <Story />
      </div>]
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "Inverted (on dark background)",
  args: {
    inverted: true
  },
  decorators: [Story => <div style={{
    background: "#0f172a",
    padding: "2rem",
    borderRadius: "0.75rem"
  }}>
        <Story />
      </div>]
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "Empty array (renders nothing)",
  args: {
    ctas: []
  }
}`,...v.parameters?.docs?.source}}},y=[`Default`,`SingleCTA`,`ThreeCTAs`,`SmallSize`,`LargeSize`,`CentreAligned`,`EndAligned`,`InvertedOnBrand`,`InvertedOnDark`,`EmptyCTAs`]}))();export{m as CentreAligned,l as Default,v as EmptyCTAs,h as EndAligned,g as InvertedOnBrand,_ as InvertedOnDark,p as LargeSize,u as SingleCTA,f as SmallSize,d as ThreeCTAs,y as __namedExportsOrder,c as default};