import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,r,t as i}from"./MetaList-mrha1zQ7.js";var a,o,s,c,l,u,d,f;e((()=>{a=t(),r(),o={title:`Molecules/MetaList`,component:i,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Vertical stack of labelled metadata rows. `MetaItem` renders a label + value grid row with a bottom-border separator. `MetaList` removes the trailing border from its last child. Used for structured fact-lists on vacancy and article detail pages."}}},argTypes:{label:{control:`text`},value:{control:`text`},urgent:{control:`boolean`}},args:{label:`Location`,value:`Amsterdam, Netherlands`,urgent:!1},decorators:[e=>(0,a.jsx)(`div`,{style:{maxWidth:`28rem`,background:`var(--card-bg, #fff)`,borderRadius:`var(--card-radius, 0.5rem)`,border:`1px solid var(--card-border, #e2e8f0)`,paddingBlock:`0.5rem`},children:(0,a.jsx)(e,{})})]},s={name:`Single MetaItem`,render:e=>(0,a.jsx)(n,{children:(0,a.jsx)(i,{...e})})},c={name:`Urgent value`,args:{label:`Deadline`,value:`31 March 2026`,urgent:!0},render:e=>(0,a.jsx)(n,{children:(0,a.jsx)(i,{...e})})},l={name:`Vacancy details (MetaList)`,render:()=>(0,a.jsxs)(n,{children:[(0,a.jsx)(i,{label:`Location`,value:`Amsterdam, NL`}),(0,a.jsx)(i,{label:`Contract`,value:`Full-time`}),(0,a.jsx)(i,{label:`Salary`,value:`€75,000 – €95,000`}),(0,a.jsx)(i,{label:`Level`,value:`Senior`}),(0,a.jsx)(i,{label:`Start`,value:`1 April 2026`}),(0,a.jsx)(i,{label:`Deadline`,value:`31 March 2026`,urgent:!0})]})},u={name:`Article metadata`,render:()=>(0,a.jsxs)(n,{children:[(0,a.jsx)(i,{label:`Author`,value:`Sophie van der Berg`}),(0,a.jsx)(i,{label:`Published`,value:`28 March 2026`}),(0,a.jsx)(i,{label:`Category`,value:`Engineering`}),(0,a.jsx)(i,{label:`Read time`,value:`6 min`})]})},d={name:`Custom child content`,render:()=>(0,a.jsxs)(n,{children:[(0,a.jsx)(i,{label:`Status`,children:(0,a.jsxs)(`span`,{style:{display:`inline-flex`,alignItems:`center`,gap:`0.375rem`,fontSize:`0.875rem`,color:`var(--color-success-600, #16a34a)`,fontWeight:600},children:[(0,a.jsx)(`svg`,{width:`12`,height:`12`,viewBox:`0 0 12 12`,fill:`currentColor`,"aria-hidden":`true`,children:(0,a.jsx)(`circle`,{cx:`6`,cy:`6`,r:`6`})}),`Active`]})}),(0,a.jsx)(i,{label:`Location`,value:`Amsterdam, NL`})]})},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "Single MetaItem",
  render: args => <MetaList>
      <MetaItem {...args} />
    </MetaList>
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Urgent value",
  args: {
    label: "Deadline",
    value: "31 March 2026",
    urgent: true
  },
  render: args => <MetaList>
      <MetaItem {...args} />
    </MetaList>
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "Vacancy details (MetaList)",
  render: () => <MetaList>
      <MetaItem label="Location" value="Amsterdam, NL" />
      <MetaItem label="Contract" value="Full-time" />
      <MetaItem label="Salary" value="€75,000 – €95,000" />
      <MetaItem label="Level" value="Senior" />
      <MetaItem label="Start" value="1 April 2026" />
      <MetaItem label="Deadline" value="31 March 2026" urgent />
    </MetaList>
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "Article metadata",
  render: () => <MetaList>
      <MetaItem label="Author" value="Sophie van der Berg" />
      <MetaItem label="Published" value="28 March 2026" />
      <MetaItem label="Category" value="Engineering" />
      <MetaItem label="Read time" value="6 min" />
    </MetaList>
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Custom child content",
  render: () => <MetaList>
      <MetaItem label="Status">
        <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        fontSize: "0.875rem",
        color: "var(--color-success-600, #16a34a)",
        fontWeight: 600
      }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="6" r="6" />
          </svg>
          Active
        </span>
      </MetaItem>
      <MetaItem label="Location" value="Amsterdam, NL" />
    </MetaList>
}`,...d.parameters?.docs?.source}}},f=[`SingleItem`,`UrgentItem`,`VacancyDetails`,`ArticleMeta`,`WithCustomContent`]}))();export{u as ArticleMeta,s as SingleItem,c as UrgentItem,l as VacancyDetails,d as WithCustomContent,f as __namedExportsOrder,o as default};