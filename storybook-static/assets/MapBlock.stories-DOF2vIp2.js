import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./Container-Dm6GW6eo.js";import{n as i,t as a}from"./Section-CFvIh-Sw.js";function o({data:e}){let t=e.embedUrl??c,n=e.address?[e.address,e.city,e.country].filter(Boolean).join(`, `):l,i=e.email??u,o=e.phone??d;return(0,s.jsx)(a,{children:(0,s.jsxs)(r,{children:[e.heading&&(0,s.jsx)(`h2`,{style:{fontFamily:`var(--font-heading, inherit)`,fontWeight:`var(--font-heading-weight, 700)`,fontSize:`clamp(1.5rem, 3vw, 2.25rem)`,color:`var(--text)`,marginBottom:`2rem`,lineHeight:1.2},children:e.heading}),(0,s.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`2fr 1fr`,gap:`2rem`,alignItems:`stretch`},className:`map-block-grid`,children:[(0,s.jsx)(`div`,{style:{borderRadius:`var(--card-radius, 0.75rem)`,overflow:`hidden`,height:`420px`,border:`1px solid var(--card-border, #e5e7eb)`,flexShrink:0},children:(0,s.jsx)(`iframe`,{src:t,width:`100%`,height:`420`,style:{border:0,display:`block`},allowFullScreen:!0,loading:`lazy`,referrerPolicy:`no-referrer-when-downgrade`,title:`Office location map`})}),(0,s.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`1.5rem`,padding:`2rem`,background:`var(--bg-subtle, #f9fafb)`,borderRadius:`var(--card-radius, 0.75rem)`,border:`1px solid var(--card-border, #e5e7eb)`},children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{style:{fontWeight:600,fontSize:`0.75rem`,textTransform:`uppercase`,letterSpacing:`0.08em`,color:`var(--text-muted, #6b7280)`,marginBottom:`0.375rem`},children:`Address`}),(0,s.jsx)(`address`,{style:{fontStyle:`normal`,color:`var(--text, #111827)`,fontSize:`0.9375rem`,lineHeight:1.6},children:n})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{style:{fontWeight:600,fontSize:`0.75rem`,textTransform:`uppercase`,letterSpacing:`0.08em`,color:`var(--text-muted, #6b7280)`,marginBottom:`0.375rem`},children:`Email`}),(0,s.jsx)(`a`,{href:`mailto:${i}`,style:{color:`var(--primary, #4f46e5)`,textDecoration:`none`,fontSize:`0.9375rem`},children:i})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{style:{fontWeight:600,fontSize:`0.75rem`,textTransform:`uppercase`,letterSpacing:`0.08em`,color:`var(--text-muted, #6b7280)`,marginBottom:`0.375rem`},children:`Phone`}),(0,s.jsx)(`a`,{href:`tel:${o.replace(/\s/g,``)}`,style:{color:`var(--text, #111827)`,textDecoration:`none`,fontSize:`0.9375rem`},children:o})]})]})]}),(0,s.jsx)(`style`,{children:`
          @media (max-width: 767px) {
            .map-block-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `})]})})}var s,c,l,u,d,f=e((()=>{s=t(),n(),i(),c=`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d39036.34844027267!2d4.880151!3d52.373082!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c609c7f8d7d3bb%3A0x1fafca0e7d63ed40!2sKeizersgracht%20125%2C%201015%20CJ%20Amsterdam%2C%20Netherlands!5e0!3m2!1sen!2snl!4v1234567890`,l=`Keizersgracht 125, 1015 CJ Amsterdam, Netherlands`,u=`hello@misterchameleon.io`,d=`+31 20 123 4567`,o.__docgenInfo={description:``,methods:[],displayName:`MapBlock`,props:{data:{required:!0,tsType:{name:`MapBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),p,m,h,g,_,v,y;e((()=>{f(),p={heading:`Visit us`,address:`Keizersgracht 125`,city:`Amsterdam`,country:`Netherlands`,email:`hello@mister-chameleon.com`,phone:`+31 20 123 4567`,embedUrl:`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.066792041!2d4.8801!3d52.3731!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2snl!4v1700000000000`},m={title:`Blocks/Sections/Map`,component:o,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Office location block — a Google Maps iframe alongside address, phone, and email. Desktop: map on the left (2/3), contact details on the right (1/3). Mobile: stacked, map first.`}}}},h={name:`Default (with map embed)`,args:{data:p}},g={name:`No embed URL (contact details only)`,args:{data:{...p,embedUrl:void 0}}},_={name:`No heading`,args:{data:{...p,heading:void 0}}},v={name:`Minimal — email only`,args:{data:{email:`hello@example.com`,embedUrl:p.embedUrl}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "Default (with map embed)",
  args: {
    data: baseData
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "No embed URL (contact details only)",
  args: {
    data: {
      ...baseData,
      embedUrl: undefined
    }
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: {
      ...baseData,
      heading: undefined
    }
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "Minimal — email only",
  args: {
    data: {
      email: "hello@example.com",
      embedUrl: baseData.embedUrl
    }
  }
}`,...v.parameters?.docs?.source}}},y=[`Default`,`NoEmbed`,`NoHeading`,`MinimalContact`]}))();export{h as Default,v as MinimalContact,g as NoEmbed,_ as NoHeading,y as __namedExportsOrder,m as default};