import{n as e,o as t}from"./chunk-vNrZSFDR.js";import{M as n,rt as r}from"./iframe-BPplKtwB.js";import{n as i,t as a}from"./Container-Dm6GW6eo.js";import{n as o,t as s}from"./Section-CFvIh-Sw.js";import{n as c,t as l}from"./Stack-BQGne2u8.js";import{n as u,t as d}from"./Grid-nQzDC2-U.js";import{n as f,t as p}from"./SearchResultCard-DWTFPqSL.js";async function m(e){let t=await fetch(`/api/search`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)});if(!t.ok)throw Error(`Search request failed: ${t.status}`);return t.json()}function h(e){if(!e?.length)return;let t=e.filter(e=>S.includes(e));return t.length?t:void 0}function g({value:e,placeholder:t,onChange:n,onSubmit:r,isLoading:i}){function a(e){e.preventDefault(),r()}return(0,b.jsxs)(`form`,{role:`search`,onSubmit:a,style:{display:`flex`,gap:`0.5rem`,width:`100%`},children:[(0,b.jsx)(`input`,{type:`search`,value:e,placeholder:t,onChange:e=>n(e.target.value),"aria-label":`Search`,autoComplete:`off`,style:{flex:1,padding:`0.625rem 0.875rem`,border:`1px solid var(--form-input-border, #d1d5db)`,borderRadius:`var(--form-input-radius, var(--radius-md, 0.5rem))`,fontSize:`0.9375rem`,color:`var(--form-input-text, var(--text, #111827))`,background:`var(--form-input-bg, #fff)`,outline:`none`,minWidth:0},onFocus:e=>{e.currentTarget.style.borderColor=`var(--primary)`,e.currentTarget.style.boxShadow=`0 0 0 3px var(--primary-subtle)`},onBlur:e=>{e.currentTarget.style.borderColor=`var(--form-input-border, #d1d5db)`,e.currentTarget.style.boxShadow=`none`}}),(0,b.jsx)(`button`,{type:`submit`,disabled:i||!e.trim(),"aria-label":`Submit search`,style:{padding:`0.625rem 1.25rem`,background:`var(--btn-bg)`,color:`var(--btn-primary-text, #fff)`,border:`none`,borderRadius:`var(--form-input-radius, var(--radius-md, 0.5rem))`,fontSize:`0.9375rem`,fontWeight:600,cursor:i?`wait`:`pointer`,opacity:i||!e.trim()?.6:1,whiteSpace:`nowrap`,transition:`opacity 0.15s ease`},children:i?`Searching…`:`Search`})]})}function _({activeScopes:e,availableScopes:t,onToggle:n}){return(0,b.jsx)(`div`,{role:`group`,"aria-label":`Filter by content type`,style:{display:`flex`,flexWrap:`wrap`,gap:`0.5rem`},children:t.map(t=>{let r=e.includes(t);return(0,b.jsx)(`button`,{type:`button`,onClick:()=>n(t),"aria-pressed":r,style:{padding:`0.25rem 0.75rem`,borderRadius:`var(--radius-full, 9999px)`,border:`1px solid ${r?`var(--primary)`:`var(--card-border)`}`,background:r?`var(--primary-subtle)`:`transparent`,color:r?`var(--primary)`:`var(--text-muted)`,fontSize:`0.8125rem`,fontWeight:r?600:400,cursor:`pointer`,transition:`all 0.1s ease`},children:C[t]},t)})})}function v({status:e,results:t,total:n,query:r,emptyMessage:i,noResultsMessage:a,variant:o}){if(e===`idle`)return(0,b.jsx)(`p`,{style:{color:`var(--text-muted, #6b7280)`,fontSize:`0.9375rem`,margin:0},children:i});if(e===`loading`)return(0,b.jsx)(`p`,{role:`status`,"aria-live":`polite`,style:{color:`var(--text-muted, #6b7280)`,fontSize:`0.9375rem`,margin:0},children:`Searching…`});if(e===`error`)return(0,b.jsx)(`p`,{role:`alert`,style:{color:`var(--color-error-600, #dc2626)`,fontSize:`0.9375rem`,margin:0},children:`Something went wrong. Please try again.`});if(e===`success`&&t.length===0)return(0,b.jsx)(`p`,{"aria-live":`polite`,style:{color:`var(--text-muted, #6b7280)`,fontSize:`0.9375rem`,margin:0},children:a});let s=o===`minimal`?`compact`:`row`;return(0,b.jsxs)(`div`,{children:[(0,b.jsx)(`p`,{"aria-live":`polite`,style:{fontSize:`0.8125rem`,color:`var(--text-muted, #6b7280)`,marginBottom:`0.875rem`,margin:`0 0 0.875rem`},children:n===1?`1 result for "${r}"`:`${n} results for "${r}"`}),o===`default`||o===`full`?(0,b.jsx)(d,{cols:2,children:t.map(e=>(0,b.jsx)(p,{result:e,layout:`card`},e.id))}):(0,b.jsx)(`div`,{children:t.map(e=>(0,b.jsx)(p,{result:e,layout:s},e.id))})]})}function y({data:e,variant:t=`default`}){let[n,r]=(0,x.useState)(``),[i,o]=(0,x.useState)([]),[c,u]=(0,x.useState)(0),[d,f]=(0,x.useState)(`idle`),[p,y]=(0,x.useState)(``),C=(0,x.useRef)(null),w=h(e.scopes),T=S,[E,D]=(0,x.useState)(w??[...T]),O=(0,x.useCallback)(e=>{D(t=>t.includes(e)?t.length>1?t.filter(t=>t!==e):t:[...t,e])},[]),k=(0,x.useCallback)(async(t,n)=>{let r=t.trim();if(!r){f(`idle`),o([]),u(0),y(``);return}f(`loading`),y(r);let i={query:r,scopes:n.length?n:void 0,limit:e.maxResults??10,offset:0};try{let e=await m(i);o([...e.results]),u(e.total),f(`success`)}catch{f(`error`),o([]),u(0)}},[e.maxResults]),A=(0,x.useCallback)(t=>{r(t),e.enableInstant&&(C.current&&clearTimeout(C.current),C.current=setTimeout(()=>{k(t,E)},300))},[e.enableInstant,k,E]),j=(0,x.useCallback)(()=>{C.current&&clearTimeout(C.current),k(n,E)},[k,n,E]),M=e.placeholder??`Search…`,N=e.emptyMessage??`Start typing to search.`,P=e.noResultsMessage??`No results found for "${p}".`;return t===`minimal`?(0,b.jsxs)(`div`,{style:{width:`100%`},children:[(0,b.jsx)(g,{value:n,placeholder:M,onChange:A,onSubmit:j,isLoading:d===`loading`}),d!==`idle`&&(0,b.jsx)(`div`,{style:{marginTop:`1rem`},children:(0,b.jsx)(v,{status:d,results:i,total:c,query:p,emptyMessage:N,noResultsMessage:P,variant:t})})]}):(0,b.jsx)(s,{style:{background:`var(--bg-subtle, #f9fafb)`},children:(0,b.jsx)(a,{size:`lg`,children:(0,b.jsxs)(l,{gap:6,children:[(e.title||e.description)&&(0,b.jsxs)(`div`,{children:[e.title&&(0,b.jsx)(`h2`,{style:{margin:0,fontSize:`clamp(1.5rem, 3vw, 2rem)`,fontWeight:`var(--font-heading-weight, 700)`,fontFamily:`var(--font-heading, inherit)`,color:`var(--text, #111827)`,marginBottom:e.description?`0.5rem`:0},children:e.title}),e.description&&(0,b.jsx)(`p`,{style:{margin:0,color:`var(--text-muted, #6b7280)`,fontSize:`1rem`,maxWidth:`60ch`},children:e.description})]}),(0,b.jsx)(g,{value:n,placeholder:M,onChange:A,onSubmit:j,isLoading:d===`loading`}),t===`full`&&e.showFilters!==!1&&(0,b.jsx)(_,{activeScopes:E,availableScopes:w??T,onToggle:O}),(0,b.jsx)(v,{status:d,results:i,total:c,query:p,emptyMessage:N,noResultsMessage:P,variant:t})]})})})}var b,x,S,C,w=e((()=>{b=n(),x=t(r()),f(),o(),i(),c(),u(),S=[`pages`,`posts`,`vacancies`],C={pages:`Pages`,posts:`Posts`,vacancies:`Vacancies`},y.__docgenInfo={description:``,methods:[],displayName:`SearchBlock`,props:{data:{required:!0,tsType:{name:`SearchBlockData`},description:``},variant:{required:!1,tsType:{name:`string`},description:``,defaultValue:{value:`"default"`,computed:!1}}}}}));function T(e,t){let n=e.toLowerCase().split(/\s+/).filter(Boolean),r=D.filter(e=>{if(!(!t?.length||t.includes(e.type===`page`?`pages`:e.type===`post`?`posts`:`vacancies`)))return!1;let r=`${e.title} ${e.excerpt??``}`.toLowerCase();return n.some(e=>r.includes(e))});return{query:{query:e,scopes:t,limit:10,offset:0},results:r,total:r.length,hasMore:!1}}var E,D,O,k,A,j,M,N,P,F,I,L,R;e((()=>{E=n(),w(),D=[{id:`blog/de-toekomst-van-b2b-marketing`,type:`post`,title:`De toekomst van B2B-marketing: personalisatie op schaal`,slug:`/blog/de-toekomst-van-b2b-marketing`,excerpt:`Hoe predictive personalisation de relatie tussen merk en koper fundamenteel verandert — en waarom de winnaar die het CMS als beslissingsengine inzet.`,image:{src:`https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80`,alt:`Data on screen`},meta:[{label:`Leestijd`,value:`7 min`}]},{id:`vacancies/senior-frontend-developer`,type:`vacancy`,title:`Senior Frontend Developer`,slug:`/vacancies/senior-frontend-developer`,excerpt:`Wij zoeken een ervaren frontend developer met kennis van Next.js, TypeScript en modern CSS. Je werkt samen met ons team aan uitdagende B2B-projecten.`,meta:[{label:`Locatie`,value:`Amsterdam`},{label:`Contract`,value:`Full-time`}]},{id:`pages/over`,type:`page`,title:`Over Mister Chameleon`,slug:`/over`,excerpt:`Mister Chameleon is een B2B-marketingbureau gespecialiseerd in digitale strategie, contentmarketing en website-ontwikkeling voor ambitieuze mkb-bedrijven.`},{id:`pages/diensten`,type:`page`,title:`Onze diensten`,slug:`/diensten`,excerpt:`Van contentmarketing tot technische SEO en website-development. We bieden een volledig pakket voor B2B-bedrijven die willen groeien.`}],O=(e,t)=>{{let e=window.fetch;window.fetch=async(t,n)=>{if((typeof t==`string`?t:t.url).includes(`/api/search`)){let e=n?.body?JSON.parse(n.body):{},t=T(e.query??``,e.scopes);return await new Promise(e=>setTimeout(e,350)),new Response(JSON.stringify(t),{status:200,headers:{"Content-Type":`application/json`}})}return e(t,n)},t.parameters._restoreFetch=()=>{window.fetch=e}}return(0,E.jsx)(e,{})},k={title:`Blocks/Sections/Search`,component:y,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Full-text search input + inline results block. Submit-driven by default; supports instant search (debounced). Three variants: **default** (section heading + results), **minimal** (bare input), **full** (with scope filter toggles). In production, search is served by the active SearchProvider — resolution order: Meilisearch → Sanity GROQ → **Statamic FS** → InMemory.`}}}},A={title:`Zoeken`,description:`Vind artikelen, pagina's en vacatures op de site.`,placeholder:`Typ om te zoeken…`,emptyMessage:`Voer een zoekterm in om resultaten te zien.`,noResultsMessage:`Geen resultaten gevonden — probeer een andere term.`,maxResults:9,enableInstant:!1,showFilters:!1},j={name:`default — heading + description + search bar (idle)`,args:{data:A,variant:`default`}},M={name:`full — default + scope filter toggles (idle)`,args:{data:{...A,title:`Site zoeken`,description:`Doorzoek alle content-types.`,showFilters:!0,scopes:[`pages`,`posts`,`vacancies`]},variant:`full`}},N={name:`minimal — bare search input only (idle)`,args:{data:{placeholder:`Doorzoek de site…`,emptyMessage:`Begin met typen om te zoeken.`,noResultsMessage:`Niets gevonden.`},variant:`minimal`}},P={name:`vacancies only — scoped search (idle)`,args:{data:{...A,title:`Vacatures zoeken`,description:`Doorzoek onze openstaande vacatures.`,placeholder:`bijv. Frontend, Amsterdam, Marketing…`,scopes:[`vacancies`]},variant:`default`}},F={name:`default — with results (mocked API)`,args:{data:{...A,enableInstant:!0},variant:`default`},decorators:[O],play:async({canvasElement:e})=>{let t=e.querySelector(`input[type='search']`);t&&((Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,`value`)?.set)?.call(t,`marketing`),t.dispatchEvent(new Event(`input`,{bubbles:!0})))}},I={name:`full — with results + scope filters (mocked API)`,args:{data:{...A,title:`Site zoeken`,description:`Doorzoek alle content-types.`,showFilters:!0,scopes:[`pages`,`posts`,`vacancies`],enableInstant:!0},variant:`full`},decorators:[O],play:async({canvasElement:e})=>{let t=e.querySelector(`input[type='search']`);t&&((Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,`value`)?.set)?.call(t,`b2b`),t.dispatchEvent(new Event(`input`,{bubbles:!0})))}},L={name:`default — no results (mocked API, unmatched query)`,args:{data:{...A,enableInstant:!0,noResultsMessage:`Geen resultaten gevonden voor deze zoekopdracht.`},variant:`default`},decorators:[O],play:async({canvasElement:e})=>{let t=e.querySelector(`input[type='search']`);t&&((Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,`value`)?.set)?.call(t,`zzzznotfound`),t.dispatchEvent(new Event(`input`,{bubbles:!0})))}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  name: "default — heading + description + search bar (idle)",
  args: {
    data: base,
    variant: "default"
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  name: "full — default + scope filter toggles (idle)",
  args: {
    data: {
      ...base,
      title: "Site zoeken",
      description: "Doorzoek alle content-types.",
      showFilters: true,
      scopes: ["pages", "posts", "vacancies"]
    },
    variant: "full"
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  name: "minimal — bare search input only (idle)",
  args: {
    data: {
      placeholder: "Doorzoek de site…",
      emptyMessage: "Begin met typen om te zoeken.",
      noResultsMessage: "Niets gevonden."
    } as SearchBlockData,
    variant: "minimal"
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  name: "vacancies only — scoped search (idle)",
  args: {
    data: {
      ...base,
      title: "Vacatures zoeken",
      description: "Doorzoek onze openstaande vacatures.",
      placeholder: "bijv. Frontend, Amsterdam, Marketing…",
      scopes: ["vacancies"]
    },
    variant: "default"
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  name: "default — with results (mocked API)",
  args: {
    data: {
      ...base,
      enableInstant: true
    },
    variant: "default"
  },
  decorators: [withFetchMock],
  play: async ({
    canvasElement
  }) => {
    // Trigger an instant search so results are visible without clicking
    const input = canvasElement.querySelector<HTMLInputElement>("input[type='search']");
    if (!input) return;
    // Use native input value setter so React picks up the change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    nativeInputValueSetter?.call(input, "marketing");
    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));
  }
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  name: "full — with results + scope filters (mocked API)",
  args: {
    data: {
      ...base,
      title: "Site zoeken",
      description: "Doorzoek alle content-types.",
      showFilters: true,
      scopes: ["pages", "posts", "vacancies"],
      enableInstant: true
    },
    variant: "full"
  },
  decorators: [withFetchMock],
  play: async ({
    canvasElement
  }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("input[type='search']");
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "b2b");
    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));
  }
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  name: "default — no results (mocked API, unmatched query)",
  args: {
    data: {
      ...base,
      enableInstant: true,
      noResultsMessage: "Geen resultaten gevonden voor deze zoekopdracht."
    },
    variant: "default"
  },
  decorators: [withFetchMock],
  play: async ({
    canvasElement
  }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("input[type='search']");
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "zzzznotfound");
    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));
  }
}`,...L.parameters?.docs?.source}}},R=[`Default`,`Full`,`Minimal`,`VacanciesOnly`,`WithResultsDefault`,`WithResultsFull`,`NoResults`]}))();export{j as Default,M as Full,N as Minimal,L as NoResults,P as VacanciesOnly,F as WithResultsDefault,I as WithResultsFull,R as __namedExportsOrder,k as default};