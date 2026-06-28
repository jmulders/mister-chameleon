import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";function n(e,t,n,r){if(!n&&!r)return e;try{let i=new URL(e);if(t===`youtube`){if(n&&(i.searchParams.set(`autoplay`,`1`),i.searchParams.set(`mute`,`1`)),r){i.searchParams.set(`loop`,`1`);let e=i.pathname.split(`/`).pop();e&&i.searchParams.set(`playlist`,e)}}else t===`vimeo`&&(n&&(i.searchParams.set(`autoplay`,`1`),i.searchParams.set(`muted`,`1`)),r&&i.searchParams.set(`loop`,`1`));return i.toString()}catch{return e}}function r({data:e,variant:t}){let r=t===`full-width`;return e.platform===`native`?(0,i.jsx)(`section`,{className:`py-12`,style:{background:`var(--section-bg, transparent)`},children:(0,i.jsxs)(`div`,{className:r?``:`mx-auto max-w-4xl px-6`,children:[(0,i.jsx)(`video`,{src:e.url,poster:e.posterUrl,autoPlay:e.autoPlay,loop:e.loop,muted:e.muted??e.autoPlay,controls:!e.autoPlay,playsInline:!0,style:{width:`100%`,borderRadius:`var(--card-radius, 0.5rem)`,display:`block`}}),e.caption&&(0,i.jsx)(`p`,{className:`mt-3 text-sm text-center`,style:{color:`var(--text-muted, #6b7280)`},children:e.caption})]})}):(0,i.jsx)(`section`,{className:`py-12`,style:{background:`var(--section-bg, transparent)`},children:(0,i.jsxs)(`div`,{className:r?``:`mx-auto max-w-4xl px-6`,children:[(0,i.jsx)(`div`,{style:{position:`relative`,paddingBottom:`56.25%`,height:0,overflow:`hidden`,borderRadius:`var(--card-radius, 0.5rem)`},children:(0,i.jsx)(`iframe`,{src:n(e.url,e.platform,e.autoPlay,e.loop),title:e.caption??`Video`,allow:`accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share`,allowFullScreen:!0,style:{position:`absolute`,inset:0,width:`100%`,height:`100%`,border:`none`}})}),e.caption&&(0,i.jsx)(`p`,{className:`mt-3 text-sm text-center`,style:{color:`var(--text-muted, #6b7280)`},children:e.caption})]})})}var i,a=e((()=>{i=t(),r.__docgenInfo={description:``,methods:[],displayName:`VideoBlock`,props:{data:{required:!0,tsType:{name:`VideoBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``}}}})),o,s,c,l,u,d,f,p,m,h;e((()=>{a(),o={url:`https://www.youtube.com/embed/dQw4w9WgXcQ`,platform:`youtube`,caption:`Product walkthrough — see how personalisation works end to end.`},s={url:`https://player.vimeo.com/video/148751763`,platform:`vimeo`,caption:`Behind the scenes at our engineering team.`},c={url:`https://www.w3schools.com/html/mov_bbb.mp4`,platform:`native`,posterUrl:`https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&q=80`,caption:`Hosted MP4 with poster image.`,autoPlay:!1,loop:!1},l={title:`Blocks/Sections/Video`,component:r,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Standalone video section — responsive 16:9 embed for YouTube, Vimeo, or a native `<video>` element for direct file URLs. Variants: `contained` (default — centred, max 56rem), `full-width`."}}}},u={name:`YouTube — contained (default)`,args:{data:o,variant:`contained`}},d={name:`YouTube — full-width`,args:{data:o,variant:`full-width`}},f={name:`Vimeo embed`,args:{data:s,variant:`contained`}},p={name:`Native <video> with poster`,args:{data:c,variant:`contained`}},m={name:`No caption`,args:{data:{...o,caption:void 0},variant:`contained`}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "YouTube — contained (default)",
  args: {
    data: youtubeData,
    variant: "contained"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "YouTube — full-width",
  args: {
    data: youtubeData,
    variant: "full-width"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Vimeo embed",
  args: {
    data: vimeoData,
    variant: "contained"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Native <video> with poster",
  args: {
    data: nativeData,
    variant: "contained"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "No caption",
  args: {
    data: {
      ...youtubeData,
      caption: undefined
    },
    variant: "contained"
  }
}`,...m.parameters?.docs?.source}}},h=[`YouTube`,`YouTubeFullWidth`,`Vimeo`,`Native`,`NoCaption`]}))();export{p as Native,m as NoCaption,f as Vimeo,u as YouTube,d as YouTubeFullWidth,h as __namedExportsOrder,l as default};