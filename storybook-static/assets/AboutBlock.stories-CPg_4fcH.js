import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";import{n as o,t as s}from"./Stack-BQGne2u8.js";import{n as c,t as l}from"./Text-Dp98UGuY.js";import{n as u,t as d}from"./block-variants-Ci_fdGtY.js";import{n as f,t as p}from"./surface-kVxEVXL4.js";function m({member:e}){return(0,v.jsxs)(`div`,{className:`flex flex-col items-center gap-3 rounded-xl border p-6 text-center`,style:{backgroundColor:`var(--card-bg, white)`,borderColor:`var(--card-border)`,borderRadius:`var(--card-radius)`},children:[e.imageUrl&&(0,v.jsx)(`img`,{src:e.imageUrl,alt:e.name,className:`h-16 w-16 rounded-full object-cover`}),!e.imageUrl&&(0,v.jsx)(`div`,{className:`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold`,style:{background:`var(--section-subtle-bg)`,color:`var(--text-brand)`},children:e.name.charAt(0)}),(0,v.jsxs)(`div`,{children:[(0,v.jsx)(l,{variant:`body`,weight:`semibold`,children:e.name}),(0,v.jsx)(l,{variant:`body-sm`,style:{color:`var(--text-muted)`},children:e.role}),e.bio&&(0,v.jsx)(l,{variant:`body-sm`,color:`muted`,className:`mt-1`,children:e.bio})]})]})}function h({ctas:e}){let t=(e??[]).slice(0,2);return t.length===0?null:(0,v.jsx)(`div`,{className:`flex flex-wrap items-center gap-3`,children:t.map((e,t)=>{let n=(e.variant??(t===0?`primary`:`secondary`))===`primary`;return(0,v.jsx)(`a`,{href:e.href,className:`inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90`,style:n?{background:`var(--text-brand)`,color:`white`}:{background:`var(--bg-subtle)`,color:`var(--text)`},children:e.label},e.href)})})}function g(e){return e?e.filter(e=>e._type===`block`&&Array.isArray(e.children)).map(e=>(e.children??[]).map(e=>e.text??``).join(``)).join(` `):``}function _({data:e,variant:t,surface:n}){let i=u(`about`,t),{heading:o,body:c,imageUrl:d,imageAlt:p,teamMembers:_,ctas:y}=e,b=_??[],x=g(c),S=i===`media_right`?`split`:i;return S===`media_left`?(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(`div`,{className:`flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16`,children:[d&&(0,v.jsx)(`div`,{className:`w-full flex-shrink-0 lg:w-1/2`,children:(0,v.jsx)(`img`,{src:d,alt:p??o??``,className:`w-full rounded-xl object-cover shadow-md`,style:{maxHeight:`420px`}})}),(0,v.jsx)(`div`,{className:`flex-1`,children:(0,v.jsxs)(s,{gap:6,children:[o&&(0,v.jsx)(l,{variant:`h2`,children:o}),x&&(0,v.jsx)(l,{variant:`body`,color:`muted`,children:x}),(0,v.jsx)(h,{ctas:y})]})})]})})}):S===`media_full`?(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:10,children:[d&&(0,v.jsx)(`div`,{className:`w-full overflow-hidden rounded-xl shadow-md`,children:(0,v.jsx)(`img`,{src:d,alt:p??o??``,className:`w-full object-cover`,style:{maxHeight:`480px`}})}),(0,v.jsxs)(s,{gap:4,align:`center`,children:[o&&(0,v.jsx)(l,{variant:`h2`,align:`center`,children:o}),x&&(0,v.jsx)(l,{variant:`body`,color:`muted`,align:`center`,className:`max-w-2xl mx-auto`,children:x}),(0,v.jsx)(h,{ctas:y})]})]})})}):S===`split`?(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(`div`,{className:`flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16`,children:[(0,v.jsx)(`div`,{className:`flex-1`,children:(0,v.jsxs)(s,{gap:6,children:[o&&(0,v.jsx)(l,{variant:`h2`,children:o}),x&&(0,v.jsx)(l,{variant:`body`,color:`muted`,children:x}),(0,v.jsx)(h,{ctas:y})]})}),d&&(0,v.jsx)(`div`,{className:`w-full flex-shrink-0 lg:w-1/2`,children:(0,v.jsx)(`img`,{src:d,alt:p??o??``,className:`w-full rounded-xl object-cover shadow-md`,style:{maxHeight:`420px`}})})]})})}):S===`team-grid`?(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`lg`,children:(0,v.jsxs)(s,{gap:12,children:[(0,v.jsxs)(s,{gap:4,align:`center`,children:[o&&(0,v.jsx)(l,{variant:`h2`,align:`center`,children:o}),x&&(0,v.jsx)(l,{variant:`body`,color:`muted`,align:`center`,className:`max-w-2xl mx-auto`,children:x})]}),b.length>0&&(0,v.jsx)(`div`,{className:`grid gap-6`,style:{gridTemplateColumns:`repeat(${Math.min(b.length,4)}, minmax(0, 1fr))`},children:b.map(e=>(0,v.jsx)(m,{member:e},e.name))})]})})}):(0,v.jsx)(a,{spacing:`lg`,style:{background:f(n)??`var(--bg)`},children:(0,v.jsx)(r,{size:`md`,children:(0,v.jsxs)(s,{gap:8,align:`center`,children:[o&&(0,v.jsx)(l,{variant:`h2`,align:`center`,children:o}),d&&(0,v.jsx)(`img`,{src:d,alt:p??o??``,className:`w-full rounded-xl object-cover shadow-sm`,style:{maxHeight:`380px`}}),x&&(0,v.jsx)(l,{variant:`body`,color:`muted`,align:`center`,children:x})]})})})}var v,y=e((()=>{v=t(),n(),i(),o(),c(),d(),p(),_.__docgenInfo={description:``,methods:[],displayName:`AboutBlock`,props:{data:{required:!0,tsType:{name:`AboutBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``},surface:{required:!1,tsType:{name:`BlockSurface`},description:``}}}})),b,x,S,C,w,T,E,D,O,k;e((()=>{y(),b=[{_type:`block`,_key:`a1`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s1`,text:`We are a small, focused team on a mission to remove the friction between great ideas and great software. Founded in 2021, we have helped more than 200 companies move faster without sacrificing quality or security.`,marks:[]}]},{_type:`block`,_key:`a2`,style:`normal`,markDefs:[],children:[{_type:`span`,_key:`s2`,text:`We believe the best products come from diverse, collaborative teams — people who challenge each other, share what they know, and genuinely care about the end user.`,marks:[]}]}],x=`https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&q=80`,S=[{name:`Sophie van den Berg`,role:`Co-founder & CEO`,imageUrl:`https://i.pravatar.cc/80?img=47`,bio:`Previously VP Product at Booking.com.`},{name:`Marco Verdi`,role:`Head of Design`,imageUrl:`https://i.pravatar.cc/80?img=11`,bio:`10 years at Figma and Booking.com.`},{name:`Aigerim Bekova`,role:`Lead Engineer`,imageUrl:`https://i.pravatar.cc/80?img=23`,bio:`Former staff engineer at Stripe.`},{name:`Tom Janssen`,role:`Head of Growth`,imageUrl:`https://i.pravatar.cc/80?img=56`,bio:`Helped scale Adyen to Series B.`},{name:`Priya Sharma`,role:`Customer Success`,imageUrl:`https://i.pravatar.cc/80?img=31`,bio:`Passionate about long-term partnerships.`},{name:`Luca Bianchi`,role:`Backend Engineer`,imageUrl:`https://i.pravatar.cc/80?img=60`,bio:`Distributed systems specialist.`}],C={title:`Blocks/Sections/About`,component:_,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Narrative copy section with optional feature image. Three primary variants: media_right, media_left, media_full. Also supports team-grid for a team overview page.`}}}},w={name:`media_right — text left, image right`,args:{data:{heading:`Built by practitioners, for practitioners`,body:b,imageUrl:x,imageAlt:`Our team at work`},variant:`media_right`}},T={name:`media_left — image left, text right`,args:{data:{heading:`Our mission`,body:b,imageUrl:x,imageAlt:`Team collaboration`},variant:`media_left`}},E={name:`media_full — full-width image above text`,args:{data:{heading:`Our story`,body:b,imageUrl:x,imageAlt:`Team collaboration`},variant:`media_full`}},D={name:`default — text only, no image`,args:{data:{heading:`Who we are`,body:b},variant:`default`}},O={name:`team-grid — narrative + team member cards`,args:{data:{heading:`Meet the team`,body:b,teamMembers:[...S]},variant:`team-grid`}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "media_right — text left, image right",
  args: {
    data: {
      heading: "Built by practitioners, for practitioners",
      body: bodyBlocks,
      imageUrl,
      imageAlt: "Our team at work"
    } satisfies AboutBlockData,
    variant: "media_right"
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "media_left — image left, text right",
  args: {
    data: {
      heading: "Our mission",
      body: bodyBlocks,
      imageUrl,
      imageAlt: "Team collaboration"
    } satisfies AboutBlockData,
    variant: "media_left"
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "media_full — full-width image above text",
  args: {
    data: {
      heading: "Our story",
      body: bodyBlocks,
      imageUrl,
      imageAlt: "Team collaboration"
    } satisfies AboutBlockData,
    variant: "media_full"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "default — text only, no image",
  args: {
    data: {
      heading: "Who we are",
      body: bodyBlocks
    } satisfies AboutBlockData,
    variant: "default"
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "team-grid — narrative + team member cards",
  args: {
    data: {
      heading: "Meet the team",
      body: bodyBlocks,
      teamMembers: [...teamMembers]
    } satisfies AboutBlockData,
    variant: "team-grid"
  }
}`,...O.parameters?.docs?.source}}},k=[`MediaRight`,`MediaLeft`,`MediaFull`,`TextOnly`,`TeamGrid`]}))();export{E as MediaFull,T as MediaLeft,w as MediaRight,O as TeamGrid,D as TextOnly,k as __namedExportsOrder,C as default};