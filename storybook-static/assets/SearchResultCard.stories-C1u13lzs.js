import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./SearchResultCard-DWTFPqSL.js";var i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S;e((()=>{i=t(),n(),a={id:`pages/over`,type:`page`,title:`Over Mister Chameleon`,slug:`/over`,excerpt:`Mister Chameleon is een B2B-marketingbureau gespecialiseerd in digitale strategie, contentmarketing en website-ontwikkeling voor ambitieuze mkb-bedrijven.`},o={id:`blog/de-toekomst-van-b2b-marketing`,type:`post`,title:`De toekomst van B2B-marketing: personalisatie op schaal`,slug:`/blog/de-toekomst-van-b2b-marketing`,excerpt:`Hoe predictive personalisation de relatie tussen merk en koper fundamenteel verandert. We duiken in de beslissingsengine, adaptive content slots en serverless targeting.`,image:{src:`https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80`,alt:`Data visualisation on a screen`},meta:[{label:`Leestijd`,value:`7 min`},{label:`Categorie`,value:`Strategie`}]},s={id:`vacancies/senior-frontend-developer`,type:`vacancy`,title:`Senior Frontend Developer`,slug:`/vacancies/senior-frontend-developer`,excerpt:`Wij zoeken een ervaren frontend developer met kennis van Next.js, TypeScript en modern CSS. Je werkt samen met ons team aan uitdagende B2B-projecten.`,meta:[{label:`Locatie`,value:`Amsterdam`},{label:`Contract`,value:`Full-time`}]},c={id:`blog/b2b-seo`,type:`post`,title:`SEO voor <mark>B2B</mark>: van zoekwoord naar pipeline`,slug:`/blog/b2b-seo`,excerpt:`…hoe je <mark>B2B</mark>-SEO inricht als een volwaardig kanaal. Keyword-clusters, topical authority en de verbinding met je CRM-pipeline…`,highlights:[{field:`excerpt`,snippet:`…hoe je <mark>B2B</mark>-SEO inricht als een volwaardig kanaal. Keyword-clusters, topical authority en de verbinding met je CRM-pipeline…`}]},l={...s,id:`vacancies/marketing-manager`,title:`Online Marketing Manager`,slug:`/vacancies/online-marketing-manager`,image:{src:`https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80`,alt:`Marketing team in office`}},u={title:`Blocks/Sections/SearchResultCard`,component:r,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Single search result card. Three layout variants: **row** (default — horizontal, used in the /search results page), **card** (vertical grid card with optional cover image), and **compact** (text-only with left border accent, suitable for sidebars). Supports highlighted excerpts with `<mark>` tags rendered via `dangerouslySetInnerHTML`."}}},argTypes:{layout:{control:`select`,options:[`row`,`card`,`compact`]},headingLevel:{control:`select`,options:[2,3,4]}}},d={name:`row — page result`,args:{result:a,layout:`row`}},f={name:`row — post with meta`,args:{result:o,layout:`row`}},p={name:`row — vacancy with meta`,args:{result:s,layout:`row`}},m={name:`row — highlighted excerpt (with <mark>)`,args:{result:c,layout:`row`}},h={name:`card — post with cover image`,args:{result:o,layout:`card`},parameters:{layout:`padded`},decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:360},children:(0,i.jsx)(e,{})})]},g={name:`card — page without image`,args:{result:a,layout:`card`},decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:360},children:(0,i.jsx)(e,{})})]},_={name:`card — vacancy with image + meta`,args:{result:l,layout:`card`},decorators:[e=>(0,i.jsx)(`div`,{style:{maxWidth:360},children:(0,i.jsx)(e,{})})]},v={name:`card — 3-column grid (mixed types)`,render:()=>(0,i.jsx)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(3, 1fr)`,gap:`1rem`},children:[o,a,{...s,image:l.image}].map(e=>(0,i.jsx)(r,{result:e,layout:`card`},e.id))}),parameters:{layout:`padded`}},y={name:`compact — page`,args:{result:a,layout:`compact`}},b={name:`compact — post`,args:{result:o,layout:`compact`}},x={name:`compact — sidebar list (3 items)`,render:()=>(0,i.jsx)(`div`,{style:{maxWidth:320,background:`var(--bg-subtle, #f9fafb)`,padding:`1rem`,borderRadius:`0.5rem`},children:[a,o,s].map(e=>(0,i.jsx)(r,{result:e,layout:`compact`},e.id))})},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "row — page result",
  args: {
    result: pageResult,
    layout: "row"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "row — post with meta",
  args: {
    result: postResult,
    layout: "row"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "row — vacancy with meta",
  args: {
    result: vacancyResult,
    layout: "row"
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "row — highlighted excerpt (with <mark>)",
  args: {
    result: highlightedResult,
    layout: "row"
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "card — post with cover image",
  args: {
    result: postResult,
    layout: "card"
  },
  parameters: {
    layout: "padded"
  },
  decorators: [Story => <div style={{
    maxWidth: 360
  }}>
        <Story />
      </div>]
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "card — page without image",
  args: {
    result: pageResult,
    layout: "card"
  },
  decorators: [Story => <div style={{
    maxWidth: 360
  }}>
        <Story />
      </div>]
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "card — vacancy with image + meta",
  args: {
    result: imageResult,
    layout: "card"
  },
  decorators: [Story => <div style={{
    maxWidth: 360
  }}>
        <Story />
      </div>]
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "card — 3-column grid (mixed types)",
  render: () => <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1rem"
  }}>
      {[postResult, pageResult, {
      ...vacancyResult,
      image: imageResult.image
    }].map(r => <SearchResultCard key={r.id} result={r} layout="card" />)}
    </div>,
  parameters: {
    layout: "padded"
  }
}`,...v.parameters?.docs?.source},description:{story:`Shows how a 3-column card grid looks with mixed content types.`,...v.parameters?.docs?.description}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "compact — page",
  args: {
    result: pageResult,
    layout: "compact"
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "compact — post",
  args: {
    result: postResult,
    layout: "compact"
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "compact — sidebar list (3 items)",
  render: () => <div style={{
    maxWidth: 320,
    background: "var(--bg-subtle, #f9fafb)",
    padding: "1rem",
    borderRadius: "0.5rem"
  }}>
      {[pageResult, postResult, vacancyResult].map(r => <SearchResultCard key={r.id} result={r} layout="compact" />)}
    </div>
}`,...x.parameters?.docs?.source},description:{story:`Dense list of compact results, as you'd see in a sidebar search widget.`,...x.parameters?.docs?.description}}},S=[`RowPage`,`RowPost`,`RowVacancy`,`RowHighlighted`,`CardWithImage`,`CardNoImage`,`CardVacancy`,`CardGrid`,`CompactPage`,`CompactPost`,`CompactList`]}))();export{v as CardGrid,g as CardNoImage,_ as CardVacancy,h as CardWithImage,x as CompactList,y as CompactPage,b as CompactPost,m as RowHighlighted,d as RowPage,f as RowPost,p as RowVacancy,S as __namedExportsOrder,u as default};