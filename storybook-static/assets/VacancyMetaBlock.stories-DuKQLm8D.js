import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./block-variants-Ci_fdGtY.js";import{n as c,t as l}from"./MetaList-mrha1zQ7.js";import{t as u}from"./Breadcrumbs-CDNnD8P1.js";import{t as d}from"./molecules-CH9GzcJk.js";function f(e){try{let[t,n,r]=e.split(`-`).map(Number);if(!t||!n||!r)return e;let i=new Date(t,n-1,r),a=new Date;a.setHours(0,0,0,0);let o=Math.ceil((i.getTime()-a.getTime())/864e5);return o<0?`Closed`:o===0?`Closes today`:o<=7?`Closes in ${o} day${o===1?``:`s`}`:`Closes ${new Intl.DateTimeFormat(`en`,{day:`numeric`,month:`short`,year:`numeric`}).format(i)}`}catch{return e}}function p(e){try{let[t,n,r]=e.split(`-`).map(Number);if(!t||!n||!r)return!1;let i=new Date(t,n-1,r),a=new Date;a.setHours(0,0,0,0);let o=Math.ceil((i.getTime()-a.getTime())/864e5);return o>=0&&o<=14}catch{return!1}}function m({label:e}){return(0,g.jsx)(`span`,{style:{display:`inline-block`,fontSize:`0.8125rem`,fontWeight:500,color:`var(--text-muted)`,backgroundColor:`var(--bg-subtle)`,border:`1px solid var(--card-border)`,borderRadius:`2rem`,padding:`0.25rem 0.75rem`},children:e})}function h({data:e,variant:t}){let n=o(`vacancyMeta`,t),{title:i,department:s,location:d,remote:h,contractType:y,hoursPerWeek:b,salaryRange:x,startDate:S,closingDate:C,level:w}=e;if(n===`compact`){let e=[];return w&&e.push(w),d&&e.push(d),h&&h!==`on-site`&&e.push(_[h]),y&&e.push(v[y]),b&&e.push(b),(0,g.jsxs)(`div`,{style:{display:`flex`,flexWrap:`wrap`,gap:`0.5rem`,padding:`0.75rem 0`},children:[s&&(0,g.jsx)(`span`,{style:{fontSize:`0.75rem`,fontWeight:600,color:`var(--text-muted)`,backgroundColor:`var(--bg-subtle)`,borderRadius:`2rem`,padding:`0.1875rem 0.625rem`},children:s}),e.filter(Boolean).map(e=>(0,g.jsx)(m,{label:e},e)),C&&(0,g.jsx)(`span`,{style:{fontSize:`0.8125rem`,fontWeight:p(C)?600:400,color:p(C)?`var(--color-error-500, #ef4444)`:`var(--text-muted)`},children:f(C)})]})}return(0,g.jsx)(a,{spacing:`sm`,style:{background:`var(--bg)`},children:(0,g.jsxs)(r,{size:`md`,children:[e.breadcrumbs&&e.breadcrumbs.length>0&&(0,g.jsx)(`div`,{style:{marginBottom:`0.75rem`},children:(0,g.jsx)(u,{items:e.breadcrumbs})}),(0,g.jsxs)(`div`,{style:{backgroundColor:`var(--card-bg)`,border:`1px solid var(--card-border)`,borderRadius:`var(--card-radius)`,overflow:`hidden`},children:[(i||s)&&(0,g.jsxs)(`div`,{style:{padding:`1.25rem 1.5rem`,borderBottom:`1px solid var(--card-border)`,background:`var(--bg-subtle)`},children:[i&&(0,g.jsx)(`h2`,{style:{margin:0,fontSize:`1.125rem`,fontWeight:600,color:`var(--text)`,lineHeight:1.3},children:i}),s&&(0,g.jsx)(`span`,{style:{display:`inline-block`,marginTop:i?`0.375rem`:0,fontSize:`0.75rem`,fontWeight:600,color:`var(--text-muted)`,backgroundColor:`var(--bg-subtle)`,borderRadius:`2rem`,padding:`0.1875rem 0.625rem`},children:s})]}),(0,g.jsxs)(c,{children:[d&&(0,g.jsx)(l,{label:`Location`,value:h&&h!==`on-site`?`${d} · ${_[h]}`:d}),!d&&h&&(0,g.jsx)(l,{label:`Work style`,value:_[h]}),y&&(0,g.jsx)(l,{label:`Contract`,value:v[y]}),b&&(0,g.jsx)(l,{label:`Hours`,value:b}),w&&(0,g.jsx)(l,{label:`Level`,value:w}),x&&(0,g.jsx)(l,{label:`Salary`,value:x}),S&&(0,g.jsx)(l,{label:`Start date`,value:S}),C&&(0,g.jsx)(l,{label:`Deadline`,value:f(C),urgent:p(C)})]}),!d&&!h&&!y&&!b&&!w&&!x&&!S&&!C&&(0,g.jsx)(`div`,{style:{padding:`1.5rem`,color:`var(--text-muted)`,fontSize:`0.875rem`},children:`No details available.`})]})]})})}var g,_,v,y=e((()=>{g=t(),n(),i(),d(),s(),_={"on-site":`On-site`,hybrid:`Hybrid`,remote:`Remote`},v={"full-time":`Full-time`,"part-time":`Part-time`,contract:`Contract`,internship:`Internship`,freelance:`Freelance`},h.__docgenInfo={description:``,methods:[],displayName:`VacancyMetaBlock`,props:{data:{required:!0,tsType:{name:`VacancyMetaBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),b,x,S,C,w,T,E,D;e((()=>{y(),b={title:`Senior Frontend Engineer`,department:`Engineering`,location:`Amsterdam, Netherlands`,remote:`hybrid`,contractType:`full-time`,hoursPerWeek:`40 hours / week`,salaryRange:`€80,000 – €100,000`,level:`Senior`,startDate:`2025-06-01`,closingDate:`2025-05-15`,breadcrumbs:[{label:`Home`,href:`/`},{label:`Careers`,href:`/careers`},{label:`Engineering`,href:`/careers/engineering`}]},x={title:`Blocks/Sections/VacancyMeta`,component:h,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Structured metadata card for a vacancy detail page. Shows location, contract type, hours, salary, deadline, and level. Three variants: default (full card), compact (inline badge strip), sidebar.`}}}},S={name:`default — full metadata card`,args:{data:b,variant:`default`}},C={name:`compact — inline badge strip`,args:{data:b,variant:`compact`}},w={name:`remote role — no physical location`,args:{data:{title:`Product Designer`,department:`Design`,remote:`remote`,contractType:`full-time`,hoursPerWeek:`32–40 hours / week`,level:`Mid`,closingDate:`2025-06-30`},variant:`default`}},T={name:`compact — urgent deadline (within 14 days)`,args:{data:{...b,closingDate:new Date(Date.now()+7200*60*1e3).toISOString().split(`T`)[0]},variant:`compact`}},E={name:`minimal fields — only required data`,args:{data:{title:`Customer Success Manager`,location:`London, UK`,contractType:`full-time`},variant:`default`}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "default — full metadata card",
  args: {
    data: full,
    variant: "default"
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "compact — inline badge strip",
  args: {
    data: full,
    variant: "compact"
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "remote role — no physical location",
  args: {
    data: {
      title: "Product Designer",
      department: "Design",
      remote: "remote",
      contractType: "full-time",
      hoursPerWeek: "32–40 hours / week",
      level: "Mid",
      closingDate: "2025-06-30"
    },
    variant: "default"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "compact — urgent deadline (within 14 days)",
  args: {
    data: {
      ...full,
      // Set to a date 5 days from now; Storybook renders with today's date
      closingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    },
    variant: "compact"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "minimal fields — only required data",
  args: {
    data: {
      title: "Customer Success Manager",
      location: "London, UK",
      contractType: "full-time"
    },
    variant: "default"
  }
}`,...E.parameters?.docs?.source}}},D=[`Default`,`Compact`,`RemoteRole`,`UrgentDeadline`,`Minimal`]}))();export{C as Compact,S as Default,E as Minimal,w as RemoteRole,T as UrgentDeadline,D as __namedExportsOrder,x as default};