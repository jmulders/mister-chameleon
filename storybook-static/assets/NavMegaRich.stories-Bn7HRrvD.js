import{n as e,o as t}from"./chunk-vNrZSFDR.js";import{M as n,rt as r}from"./iframe-BPplKtwB.js";import{n as i,t as a}from"./utils-DTREARv9.js";import{t as o}from"./link-Dhuf_8VX.js";function s(){let[e,t]=(0,c.useState)(!1),n=(0,c.useRef)(null),r=(0,c.useRef)(null);(0,c.useEffect)(()=>()=>{n.current&&clearTimeout(n.current)},[]);let i=(0,c.useCallback)(()=>{n.current&&=(clearTimeout(n.current),null)},[]),a=(0,c.useCallback)(()=>{i(),t(!1)},[i]),o=(0,c.useCallback)(()=>{n.current=setTimeout(a,l)},[a]);return{open:e,setOpen:t,triggerRef:r,handleMouseEnter:(0,c.useCallback)(()=>{i(),t(!0)},[i]),handleMouseLeave:o,handleBlur:(0,c.useCallback)(e=>{e.currentTarget.contains(e.relatedTarget)||a()},[a]),handleKeyDown:(0,c.useCallback)(e=>{e.key===`Escape`&&(a(),r.current?.focus())},[a])}}var c,l,u=e((()=>{c=t(r()),l=150}));function d({className:e}){return(0,b.jsx)(`svg`,{"aria-hidden":`true`,viewBox:`0 0 20 20`,fill:`currentColor`,className:a(`size-4 shrink-0`,e),children:(0,b.jsx)(`path`,{fillRule:`evenodd`,d:`M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z`,clipRule:`evenodd`})})}function f(e){return C[e in C?e:`clean-corporate`]}function p({item:e,s:t,density:n}){let r=n===`compact`?`text-[0.8125rem]`:`text-sm`;return(0,b.jsxs)(S.default,{href:e.href,target:e.openInNewTab?`_blank`:void 0,rel:e.openInNewTab?`noopener noreferrer`:void 0,className:a(`group block rounded-md px-3`,t.linkPy,r,t.linkText,t.linkHover,t.linkTracking,`transition-colors duration-100`,`focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-1`),children:[(0,b.jsx)(`span`,{className:`font-medium leading-snug`,children:e.label}),e.description&&(0,b.jsx)(`span`,{className:a(`block mt-0.5 text-[11px] leading-snug`,t.linkDesc),children:e.description})]})}function m({item:e,s:t,megaStyle:n}){let[r,i]=(0,x.useState)(!1),o=(0,x.useRef)(null),s=(0,x.useCallback)(()=>{i(!0),o.current&&o.current.play().catch(()=>{})},[]),c=(0,x.useCallback)(()=>{i(!1),o.current&&(o.current.pause(),o.current.currentTime=0)},[]),l=r&&e.hoverAssetUrl&&e.mediaType!==`video`?e.hoverAssetUrl:e.assetUrl,u=!e.hoverAssetUrl&&e.mediaType!==`video`?t.mediaHoverClass:``,d=n===`dark-ai`&&r?`ring-1 ring-[var(--text-brand,#8b5cf6)] ring-opacity-50`:``,f=e.videoUrl?/youtube\.com\/embed\//i.test(e.videoUrl):!1,p=f&&e.videoUrl?(()=>{let t=new URL(e.videoUrl);t.searchParams.set(`autoplay`,`1`),t.searchParams.set(`mute`,`1`),t.searchParams.set(`loop`,`1`),t.searchParams.set(`controls`,`0`),t.searchParams.set(`modestbranding`,`1`);let n=t.pathname.split(`/`).pop()??``;return n&&t.searchParams.set(`playlist`,n),t.toString()})():null,m=e.mediaType===`video`&&e.videoUrl?f&&p?(0,b.jsx)(`iframe`,{src:p,allow:`autoplay; encrypted-media`,allowFullScreen:!0,className:`w-full h-full`,style:{border:0,display:`block`},"aria-label":e.alt??void 0}):(0,b.jsx)(`video`,{ref:o,src:e.videoUrl,muted:!0,loop:!0,playsInline:!0,className:`w-full h-full object-cover`,"aria-label":e.alt??void 0}):l?(0,b.jsx)(`img`,{src:l,alt:e.alt??``,className:a(`w-full h-full object-cover`,e.hoverAssetUrl?`transition-opacity duration-200`:``)}):(0,b.jsx)(`div`,{className:`w-full h-full bg-[var(--bg-subtle,#f1f5f9)] flex items-center justify-center`,children:(0,b.jsx)(`span`,{className:`text-[var(--text-muted)] text-xs`,children:`No asset`})}),h=(0,b.jsx)(`div`,{className:a(`relative overflow-hidden`,n===`dark-ai`?`aspect-[4/3]`:`aspect-[16/9]`,t.mediaBg,t.mediaRadius,t.mediaPadding,u,d,`transition-all duration-200`),onMouseEnter:s,onMouseLeave:c,children:m});return e.linkUrl?(0,b.jsxs)(S.default,{href:e.linkUrl,target:e.linkOpenInNewTab?`_blank`:void 0,rel:e.linkOpenInNewTab?`noopener noreferrer`:void 0,className:`block group focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2 rounded-sm`,children:[h,e.caption&&(0,b.jsx)(`p`,{className:a(t.captionColor,t.captionSize,t.captionMt,`leading-snug`),children:e.caption})]}):(0,b.jsxs)(`div`,{children:[h,e.caption&&(0,b.jsx)(`p`,{className:a(t.captionColor,t.captionSize,t.captionMt,`leading-snug`),children:e.caption})]})}function h({column:e,s:t,density:n,megaStyle:r,showSeparator:i}){if(e.items.length===0)return null;let o=e.columnType===`links`;return(0,b.jsxs)(`div`,{className:a(`flex flex-col`,i&&`border-l border-[var(--nav-dropdown-border,var(--border))] pl-4 first:border-l-0 first:pl-0`),children:[e.title&&e.title.trim()!==``&&(0,b.jsx)(`p`,{className:a(t.colTitleSize,t.colTitleColor,t.colTitleMb),children:e.title}),o?(0,b.jsx)(`ul`,{className:`flex flex-col gap-0`,children:e.items.map(e=>e.type===`megaMenuLinkItem`?(0,b.jsx)(`li`,{children:(0,b.jsx)(p,{item:e,s:t,density:n})},e._key):null)}):(0,b.jsx)(`div`,{className:a(`grid gap-3`,e.items.length>1?`grid-cols-2`:`grid-cols-1`),children:e.items.map(e=>e.type===`megaMenuMediaItem`?(0,b.jsx)(m,{item:e,s:t,megaStyle:r},e._key):null)})]})}function g({megaMenu:e,s:t,density:n,megaStyle:r}){let i=(0,x.useRef)(null);(0,x.useLayoutEffect)(()=>{let e=i.current;if(!e)return;e.style.transform=``;let t=e.getBoundingClientRect().right-(window.innerWidth-8);t>0&&(e.style.transform=`translateX(${-t}px)`)});let o=e.columns.filter(e=>e.items.length>0);if(o.length===0)return null;let s=r===`dark-ai`?240:r===`structured-saas`?180:210,c=Math.min(o.length*s,r===`dark-ai`?800:720);return(0,b.jsx)(`div`,{ref:i,role:`menu`,className:a(`absolute left-0 top-full z-50 mt-px`,`rounded-xl`,t.panel,t.panelPadding),style:{width:c},children:(0,b.jsx)(`div`,{className:a(`grid`,t.colGap),style:{gridTemplateColumns:`repeat(${o.length}, 1fr)`},children:o.map((e,i)=>(0,b.jsx)(h,{column:e,s:t,density:n,megaStyle:r,showSeparator:t.colSeparator&&i>0},e._key))})})}function _({item:e,density:t,megaStyle:n}){let{open:r,setOpen:i,triggerRef:o,handleMouseEnter:c,handleMouseLeave:l,handleBlur:u,handleKeyDown:p}=s(),m=f(n),h=t===`compact`?`py-2`:`py-2.5`,_={fontSize:`var(--nav-link-size, 0.875rem)`,fontWeight:`var(--nav-link-weight, 500)`,letterSpacing:`var(--nav-link-tracking, normal)`},y=n===`dark-ai`?{letterSpacing:`0.03em`}:{},x=!!e.megaMenu?.columns?.length,C=!!e.children?.length,w=x||C,T=a(`inline-flex items-center rounded-l-md px-3`,h,`text-[var(--nav-link,var(--header-fg,var(--text)))]`,`hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150`,`focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2`);return w?(0,b.jsxs)(`div`,{className:`relative`,onMouseEnter:c,onMouseLeave:l,onKeyDown:p,onBlur:u,children:[(0,b.jsxs)(`div`,{className:`inline-flex items-stretch`,children:[(0,b.jsx)(S.default,{href:e.href,target:e.openInNewTab?`_blank`:void 0,rel:e.openInNewTab?`noopener noreferrer`:void 0,style:{..._,...y},className:T,children:e.label}),(0,b.jsx)(`button`,{ref:o,"aria-label":`Toggle ${e.label} submenu`,"aria-haspopup":`true`,"aria-expanded":r,onClick:()=>i(e=>!e),style:_,className:a(`inline-flex items-center rounded-r-md pl-0.5 pr-2`,h,`text-[var(--nav-link,var(--header-fg,var(--text)))]`,`hover:text-[var(--nav-link-hover,var(--text-brand))] transition-colors duration-150`,`focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2`),children:(0,b.jsx)(d,{className:a(`transition-transform duration-150`,r&&`rotate-180`)})})]}),r&&(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(`div`,{"aria-hidden":`true`,className:`absolute left-0 top-full z-40 h-1 w-full`}),x&&e.megaMenu?(0,b.jsx)(g,{megaMenu:e.megaMenu,s:m,density:t,megaStyle:n}):(0,b.jsx)(v,{item:e,s:m,density:t})]})]}):(0,b.jsx)(S.default,{href:e.href,target:e.openInNewTab?`_blank`:void 0,rel:e.openInNewTab?`noopener noreferrer`:void 0,style:{..._,...y},className:a(T,`rounded-md`),children:e.label})}function v({item:e,s:t}){let n=(0,x.useRef)(null);(0,x.useLayoutEffect)(()=>{let e=n.current;if(!e)return;let t=e.getBoundingClientRect().right-(window.innerWidth-8);t>0&&(e.style.transform=`translateX(${-t}px)`)},[]);let r=e.children??[];if(r.length===0)return null;let i=e.megaShowImage!==!1,o=e.megaShowDescription!==!1,s=o&&r.some(e=>e.description),c=i&&r.some(e=>e.imageUrl)?220:s?230:200,l=Math.min(r.length*c,920);return(0,b.jsx)(`div`,{ref:n,role:`menu`,className:a(`absolute left-0 top-full z-50 mt-px`,`max-w-[90vw] overflow-hidden rounded-xl`,t.panel),style:{width:l},children:(0,b.jsx)(`div`,{className:`flex divide-x divide-[var(--nav-dropdown-border,var(--border))]`,children:r.map(e=>(0,b.jsxs)(S.default,{href:e.href,role:`menuitem`,target:e.openInNewTab?`_blank`:void 0,rel:e.openInNewTab?`noopener noreferrer`:void 0,className:a(`group flex flex-col gap-1.5 p-5 flex-1 min-w-0`,`focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-1`),children:[i&&e.imageUrl&&(0,b.jsx)(`div`,{className:`relative aspect-video w-full rounded-md overflow-hidden mb-1 bg-[var(--bg-subtle,#f1f5f9)]`,children:(0,b.jsx)(`img`,{src:e.imageUrl,alt:``,className:`w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]`})}),(0,b.jsx)(`span`,{className:a(`font-semibold text-sm leading-snug`,`text-[var(--nav-dropdown-text,var(--text))]`,`group-hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]`,`transition-colors duration-100`),children:e.label}),o&&e.description&&(0,b.jsx)(`span`,{className:a(`text-xs leading-relaxed line-clamp-3`,t.linkDesc),children:e.description}),(0,b.jsx)(`span`,{"aria-hidden":`true`,className:a(`mt-1 text-xs font-semibold`,`text-[var(--text-brand)]`,`group-hover:underline transition-colors duration-100`),children:`Ontdekken ›`})]},e.id))})})}function y({items:e,density:t,megaStyle:n=`clean-corporate`}){return e.length===0?null:(0,b.jsx)(`nav`,{"aria-label":`Main navigation`,className:`hidden md:flex items-center gap-0.5`,children:e.map(e=>(0,b.jsx)(_,{item:e,density:t,megaStyle:n},e.id))})}var b,x,S,C,w=e((()=>{b=n(),x=t(r()),S=t(o()),i(),u(),C={"dark-ai":{panel:`bg-[var(--nav-dropdown-bg,#0d0d12)] border border-[var(--nav-dropdown-border,rgba(255,255,255,0.08))] shadow-xl`,panelPadding:`p-6`,colGap:`gap-x-8 gap-y-0`,colSeparator:!1,colTitleSize:`text-[10px] font-semibold uppercase tracking-[0.15em]`,colTitleColor:`text-[var(--text-muted,rgba(255,255,255,0.35))]`,colTitleMb:`mb-3`,linkPy:`py-2`,linkText:`text-[var(--nav-dropdown-text,rgba(255,255,255,0.65))]`,linkHover:`hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))] hover:bg-transparent`,linkDesc:`text-[var(--text-muted,rgba(255,255,255,0.35))]`,linkTracking:`tracking-wide`,mediaBg:`bg-[var(--nav-dropdown-bg,rgba(255,255,255,0.04))]`,mediaRadius:`rounded-lg`,mediaPadding:`p-3`,captionColor:`text-[var(--text-muted,rgba(255,255,255,0.45))]`,captionSize:`text-[11px]`,captionMt:`mt-2`,mediaHoverClass:`hover:brightness-110 hover:scale-[1.02]`},"clean-corporate":{panel:`bg-[var(--nav-dropdown-bg,#ffffff)] border border-[var(--nav-dropdown-border,var(--border))] shadow-md`,panelPadding:`p-5`,colGap:`gap-x-6 gap-y-0`,colSeparator:!0,colTitleSize:`text-[11px] font-semibold uppercase tracking-wider`,colTitleColor:`text-[var(--text,#1e293b)]`,colTitleMb:`mb-2.5`,linkPy:`py-1.5`,linkText:`text-[var(--nav-dropdown-text,var(--text-muted))]`,linkHover:`hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]`,linkDesc:`text-[var(--text-muted)]`,linkTracking:``,mediaBg:`bg-[var(--bg-subtle,#f8fafc)]`,mediaRadius:`rounded-md`,mediaPadding:`p-2`,captionColor:`text-[var(--text-muted)]`,captionSize:`text-xs`,captionMt:`mt-1.5`,mediaHoverClass:`hover:scale-[1.03] hover:shadow-sm`},"structured-saas":{panel:`bg-[var(--nav-dropdown-bg,#fafaf8)] border border-[var(--nav-dropdown-border,var(--border))] shadow-sm`,panelPadding:`p-4`,colGap:`gap-x-4 gap-y-0`,colSeparator:!0,colTitleSize:`text-[10px] font-bold uppercase tracking-[0.12em]`,colTitleColor:`text-[var(--text-muted)]`,colTitleMb:`mb-2`,linkPy:`py-1`,linkText:`text-[var(--nav-dropdown-text,var(--text-muted))]`,linkHover:`hover:bg-[var(--nav-dropdown-link-hover-bg,var(--primary-subtle))] hover:text-[var(--nav-dropdown-link-hover-text,var(--text-brand))]`,linkDesc:`text-[var(--text-muted)]`,linkTracking:``,mediaBg:`bg-[var(--bg-subtle,#f1f5f9)]`,mediaRadius:`rounded`,mediaPadding:`p-1.5`,captionColor:`text-[var(--text-muted)]`,captionSize:`text-[11px]`,captionMt:`mt-1`,mediaHoverClass:`hover:scale-[1.02]`}},C.default=C[`clean-corporate`],y.__docgenInfo={description:`Desktop column-based mega menu.

Renders only in the md+ breakpoint — hidden on mobile.
MobileNav in NavBar handles mobile rendering separately.`,methods:[],displayName:`NavMegaRich`,props:{items:{required:!0,tsType:{name:`Array`,elements:[{name:`NavigationItemData`}],raw:`NavigationItemData[]`},description:``},density:{required:!0,tsType:{name:`union`,raw:`"compact" | "comfortable"`,elements:[{name:`literal`,value:`"compact"`},{name:`literal`,value:`"comfortable"`}]},description:``},megaStyle:{required:!1,tsType:{name:`union`,raw:`| "dark-ai"
| "clean-corporate"
| "structured-saas"
| "default"`,elements:[{name:`literal`,value:`"dark-ai"`},{name:`literal`,value:`"clean-corporate"`},{name:`literal`,value:`"structured-saas"`},{name:`literal`,value:`"default"`}]},description:`Visual personality derived from the active theme family.
Defaults to "clean-corporate".`,defaultValue:{value:`"clean-corporate"`,computed:!1}}}}}));function T({children:e,megaStyle:t}){return(0,E.jsx)(`div`,{className:`relative ${t===`dark-ai`?`bg-[#0a0a0f]`:t===`structured-saas`?`bg-[#fafaf8]`:`bg-white`} p-6 min-h-[400px]`,children:(0,E.jsx)(`div`,{className:`relative`,children:e})})}var E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G,K,q;e((()=>{E=n(),w(),D={id:`products`,label:`Products`,href:`/products`,megaMenu:{columns:[{_key:`col-1`,title:`Core Platform`,columnType:`links`,items:[{_key:`li-1`,type:`megaMenuLinkItem`,label:`Analytics Dashboard`,href:`/products/analytics`,description:`Real-time data and visualisations for your team.`},{_key:`li-2`,type:`megaMenuLinkItem`,label:`Automation Builder`,href:`/products/automation`,description:`Trigger actions based on visitor signals.`},{_key:`li-3`,type:`megaMenuLinkItem`,label:`AI Decisions`,href:`/products/ai`,description:`Personalise every visit using ML models.`}]},{_key:`col-2`,title:`Integrations`,columnType:`links`,items:[{_key:`li-4`,type:`megaMenuLinkItem`,label:`HubSpot CRM`,href:`/integrations/hubspot`},{_key:`li-5`,type:`megaMenuLinkItem`,label:`Sanity CMS`,href:`/integrations/sanity`},{_key:`li-6`,type:`megaMenuLinkItem`,label:`Stripe Billing`,href:`/integrations/stripe`},{_key:`li-7`,type:`megaMenuLinkItem`,label:`Vercel Deploy`,href:`/integrations/vercel`}]}]}},O={id:`solutions`,label:`Solutions`,href:`/solutions`,megaMenu:{columns:[{_key:`col-a`,title:``,columnType:`links`,items:[{_key:`la-1`,type:`megaMenuLinkItem`,label:`For SaaS Companies`,href:`/solutions/saas`},{_key:`la-2`,type:`megaMenuLinkItem`,label:`For E-commerce`,href:`/solutions/ecommerce`},{_key:`la-3`,type:`megaMenuLinkItem`,label:`For Enterprise`,href:`/solutions/enterprise`}]},{_key:`col-b`,title:`By Industry`,columnType:`links`,items:[{_key:`lb-1`,type:`megaMenuLinkItem`,label:`Financial Services`,href:`/solutions/finance`},{_key:`lb-2`,type:`megaMenuLinkItem`,label:`Healthcare`,href:`/solutions/healthcare`},{_key:`lb-3`,type:`megaMenuLinkItem`,label:`Technology`,href:`/solutions/tech`}]}]}},k={id:`showcase`,label:`Showcase`,href:`/showcase`,megaMenu:{columns:[{_key:`col-media`,title:`Featured`,columnType:`media`,items:[{_key:`mi-1`,type:`megaMenuMediaItem`,mediaType:`image`,assetUrl:`https://images.unsplash.com/photo-1555421689-d68471e189f2?w=480&q=80`,alt:`Dashboard screenshot`,caption:`Analytics Dashboard`,linkUrl:`/showcase/analytics`},{_key:`mi-2`,type:`megaMenuMediaItem`,mediaType:`image`,assetUrl:`https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=480&q=80`,hoverAssetUrl:`https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=480&q=80`,alt:`Automation builder`,caption:`Automation Builder`,linkUrl:`/showcase/automation`}]}]}},A={id:`resources`,label:`Resources`,href:`/resources`,megaMenu:{columns:[{_key:`col-links`,title:`Documentation`,columnType:`links`,items:[{_key:`rl-1`,type:`megaMenuLinkItem`,label:`Getting Started`,href:`/docs/getting-started`,description:`Set up your first Chameleon project in 5 minutes.`},{_key:`rl-2`,type:`megaMenuLinkItem`,label:`API Reference`,href:`/docs/api`,description:`Full reference for all REST and GraphQL endpoints.`},{_key:`rl-3`,type:`megaMenuLinkItem`,label:`Tutorials`,href:`/docs/tutorials`,description:`Step-by-step guides for common use cases.`},{_key:`rl-4`,type:`megaMenuLinkItem`,label:`Changelog`,href:`/docs/changelog`}]},{_key:`col-media-2`,title:`Featured Guide`,columnType:`media`,items:[{_key:`rm-1`,type:`megaMenuMediaItem`,mediaType:`image`,assetUrl:`https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=480&q=80`,alt:`Code on screen`,caption:`Advanced Personalisation →`,linkUrl:`/docs/personalisation`}]}]}},j={id:`pricing`,label:`Pricing`,href:`/pricing`},M={id:`company`,label:`Company`,href:`/company`,children:[{id:`about`,label:`About Us`,href:`/about`},{id:`careers`,label:`Careers`,href:`/careers`},{id:`blog`,label:`Blog`,href:`/blog`},{id:`press`,label:`Press`,href:`/press`},{id:`contact`,label:`Contact`,href:`/contact`}]},N=[D,O,A,j,M],P={title:`Layout/Navigation/NavMegaRich`,component:y,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`The **NavMegaRich** component renders a flexible column-based mega menu that
supports link columns, media columns (image / video / GIF), and optional
column titles.

Three theme variants are available via the \`megaStyle\` prop:
- **dark-ai** — premium, near-black, spacious, media-forward
- **clean-corporate** — light, calm, readable, clearly structured
- **structured-saas** — compact, product-like, efficient

The parent nav item is always clickable (split-trigger pattern: label navigates,
chevron toggles the panel). The hover bridge prevents premature menu close.`}}},argTypes:{megaStyle:{control:`select`,options:[`dark-ai`,`clean-corporate`,`structured-saas`,`default`],description:`Visual personality — derived from the active theme family.`},density:{control:`select`,options:[`compact`,`comfortable`]}}},F={name:`Clean Corporate — links only`,args:{items:[D,O,j],density:`comfortable`,megaStyle:`clean-corporate`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`clean-corporate`,children:(0,E.jsx)(e,{})})]},I={name:`Clean Corporate — media only`,args:{items:[k,j],density:`comfortable`,megaStyle:`clean-corporate`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`clean-corporate`,children:(0,E.jsx)(e,{})})]},L={name:`Clean Corporate — mixed (links + media)`,args:{items:N,density:`comfortable`,megaStyle:`clean-corporate`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`clean-corporate`,children:(0,E.jsx)(e,{})})]},R={name:`Clean Corporate — legacy children (backward compat)`,args:{items:[M,j],density:`comfortable`,megaStyle:`clean-corporate`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`clean-corporate`,children:(0,E.jsx)(e,{})})]},z={name:`Dark AI — links only`,args:{items:[D,O,j],density:`comfortable`,megaStyle:`dark-ai`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`dark-ai`,children:(0,E.jsx)(e,{})})]},B={name:`Dark AI — media only`,args:{items:[k,j],density:`comfortable`,megaStyle:`dark-ai`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`dark-ai`,children:(0,E.jsx)(e,{})})]},V={name:`Dark AI — mixed (links + media)`,args:{items:N,density:`comfortable`,megaStyle:`dark-ai`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`dark-ai`,children:(0,E.jsx)(e,{})})]},H={name:`Structured SaaS — links only`,args:{items:[D,O,j],density:`compact`,megaStyle:`structured-saas`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`structured-saas`,children:(0,E.jsx)(e,{})})]},U={name:`Structured SaaS — media (product screenshot)`,args:{items:[k,j],density:`compact`,megaStyle:`structured-saas`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`structured-saas`,children:(0,E.jsx)(e,{})})]},W={name:`Structured SaaS — mixed (links + screenshot)`,args:{items:N,density:`compact`,megaStyle:`structured-saas`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`structured-saas`,children:(0,E.jsx)(e,{})})]},G={name:`All themes — comparison`,render:()=>(0,E.jsx)(`div`,{className:`space-y-0 divide-y divide-neutral-200`,children:[`clean-corporate`,`dark-ai`,`structured-saas`].map(e=>(0,E.jsxs)(`div`,{className:`p-6`,children:[(0,E.jsxs)(`p`,{className:`text-xs font-mono text-neutral-500 mb-3 uppercase tracking-widest`,children:[`megaStyle: `,e]}),(0,E.jsx)(T,{megaStyle:e,children:(0,E.jsx)(y,{items:[D,A,j],density:e===`structured-saas`?`compact`:`comfortable`,megaStyle:e})})]},e))}),parameters:{layout:`fullscreen`,docs:{description:{story:`Side-by-side comparison of the same navigation data rendered in each theme variant. Hover a trigger to open the mega panel.`}}}},K={name:`Clean Corporate — compact density`,args:{items:N,density:`compact`,megaStyle:`clean-corporate`},decorators:[e=>(0,E.jsx)(T,{megaStyle:`clean-corporate`,children:(0,E.jsx)(e,{})})]},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  name: "Clean Corporate — links only",
  args: {
    items: [LINK_ITEMS_TITLED, LINK_ITEMS_UNTITLED, SIMPLE_ITEM],
    density: "comfortable",
    megaStyle: "clean-corporate"
  },
  decorators: [Story => <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>]
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  name: "Clean Corporate — media only",
  args: {
    items: [MEDIA_ITEM, SIMPLE_ITEM],
    density: "comfortable",
    megaStyle: "clean-corporate"
  },
  decorators: [Story => <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>]
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  name: "Clean Corporate — mixed (links + media)",
  args: {
    items: FULL_NAV,
    density: "comfortable",
    megaStyle: "clean-corporate"
  },
  decorators: [Story => <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>]
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: "Clean Corporate — legacy children (backward compat)",
  args: {
    items: [LEGACY_CHILDREN_ITEM, SIMPLE_ITEM],
    density: "comfortable",
    megaStyle: "clean-corporate"
  },
  decorators: [Story => <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>]
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  name: "Dark AI — links only",
  args: {
    items: [LINK_ITEMS_TITLED, LINK_ITEMS_UNTITLED, SIMPLE_ITEM],
    density: "comfortable",
    megaStyle: "dark-ai"
  },
  decorators: [Story => <ThemeWrapper megaStyle="dark-ai">
        <Story />
      </ThemeWrapper>]
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: "Dark AI — media only",
  args: {
    items: [MEDIA_ITEM, SIMPLE_ITEM],
    density: "comfortable",
    megaStyle: "dark-ai"
  },
  decorators: [Story => <ThemeWrapper megaStyle="dark-ai">
        <Story />
      </ThemeWrapper>]
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  name: "Dark AI — mixed (links + media)",
  args: {
    items: FULL_NAV,
    density: "comfortable",
    megaStyle: "dark-ai"
  },
  decorators: [Story => <ThemeWrapper megaStyle="dark-ai">
        <Story />
      </ThemeWrapper>]
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  name: "Structured SaaS — links only",
  args: {
    items: [LINK_ITEMS_TITLED, LINK_ITEMS_UNTITLED, SIMPLE_ITEM],
    density: "compact",
    megaStyle: "structured-saas"
  },
  decorators: [Story => <ThemeWrapper megaStyle="structured-saas">
        <Story />
      </ThemeWrapper>]
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  name: "Structured SaaS — media (product screenshot)",
  args: {
    items: [MEDIA_ITEM, SIMPLE_ITEM],
    density: "compact",
    megaStyle: "structured-saas"
  },
  decorators: [Story => <ThemeWrapper megaStyle="structured-saas">
        <Story />
      </ThemeWrapper>]
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: "Structured SaaS — mixed (links + screenshot)",
  args: {
    items: FULL_NAV,
    density: "compact",
    megaStyle: "structured-saas"
  },
  decorators: [Story => <ThemeWrapper megaStyle="structured-saas">
        <Story />
      </ThemeWrapper>]
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  name: "All themes — comparison",
  render: () => <div className="space-y-0 divide-y divide-neutral-200">
      {(["clean-corporate", "dark-ai", "structured-saas"] as MegaMenuStyle[]).map(style => <div key={style} className="p-6">
          <p className="text-xs font-mono text-neutral-500 mb-3 uppercase tracking-widest">
            megaStyle: {style}
          </p>
          <ThemeWrapper megaStyle={style}>
            <NavMegaRich items={[LINK_ITEMS_TITLED, MIXED_ITEM, SIMPLE_ITEM]} density={style === "structured-saas" ? "compact" : "comfortable"} megaStyle={style} />
          </ThemeWrapper>
        </div>)}
    </div>,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story: "Side-by-side comparison of the same navigation data rendered in each theme variant. " + "Hover a trigger to open the mega panel."
      }
    }
  }
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
  name: "Clean Corporate — compact density",
  args: {
    items: FULL_NAV,
    density: "compact",
    megaStyle: "clean-corporate"
  },
  decorators: [Story => <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>]
}`,...K.parameters?.docs?.source}}},q=[`CleanCorporate_Links`,`CleanCorporate_Media`,`CleanCorporate_Mixed`,`CleanCorporate_LegacyChildren`,`DarkAI_Links`,`DarkAI_Media`,`DarkAI_Mixed`,`StructuredSaaS_Links`,`StructuredSaaS_Media`,`StructuredSaaS_Mixed`,`AllThemes_Comparison`,`CompactDensity`]}))();export{G as AllThemes_Comparison,R as CleanCorporate_LegacyChildren,F as CleanCorporate_Links,I as CleanCorporate_Media,L as CleanCorporate_Mixed,K as CompactDensity,z as DarkAI_Links,B as DarkAI_Media,V as DarkAI_Mixed,H as StructuredSaaS_Links,U as StructuredSaaS_Media,W as StructuredSaaS_Mixed,q as __namedExportsOrder,P as default};