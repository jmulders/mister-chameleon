import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./TestimonialSectionBlock-0kcUCzcR.js";var r,i,a,o,s,c,l,u,d,f,p,m;e((()=>{t(),r=[{quote:`The platform reduced our time-to-publish by 60%. Our editors love the flexibility and we love not having to maintain bespoke CMS integrations.`,author:`Sophie van der Berg`,company:`Head of Digital — Nexus Media`,avatar:`https://i.pravatar.cc/150?img=47`},{quote:`We evaluated five platforms and this was the only one that could handle our multi-brand, multi-market setup without custom development.`,author:`Mark Leuven`,company:`CTO — BrandStack`,avatar:`https://i.pravatar.cc/150?img=12`},{quote:`Design tokens made it trivial to maintain brand consistency across 12 different tenant sites. A real game-changer.`,author:`Priya Nair`,company:`Lead Designer — Vantage Group`,avatar:`https://i.pravatar.cc/150?img=29`},{quote:`The onboarding process was the smoothest we've had with any SaaS vendor. Up and running in a day.`,author:`James Wouter`,company:`Engineering Manager — Flowbase`,avatar:`https://i.pravatar.cc/150?img=53`}],i={heading:`What our customers say`,testimonials:r.slice(0,3)},a={heading:`Trusted by teams worldwide`,testimonials:r},o={testimonials:r.slice(0,1)},s={title:`Blocks/Sections/TestimonialSection`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"Testimonial showcase with five variants: `default` (3-col grid), `quote-card` (full-width single quote), `testimonial_slider` (CSS-snap carousel), `testimonial_highlight` (featured + grid), `testimonial_featured_image` (large avatar + supporting grid)."}}}},c={name:`Default — 3-col grid`,args:{data:i,variant:`default`}},l={name:`quote-card — single centred quote`,args:{data:o,variant:`quote-card`}},u={name:`testimonial_slider — horizontal carousel`,args:{data:a,variant:`testimonial_slider`}},d={name:`testimonial_highlight — featured + supporting grid`,args:{data:a,variant:`testimonial_highlight`}},f={name:`testimonial_featured_image — avatar feature`,args:{data:a,variant:`testimonial_featured_image`}},p={name:`No heading`,args:{data:{testimonials:r.slice(0,3)},variant:`default`}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Default — 3-col grid",
  args: {
    data: threeTestimonials,
    variant: "default"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "quote-card — single centred quote",
  args: {
    data: singleTestimonial,
    variant: "quote-card"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "testimonial_slider — horizontal carousel",
  args: {
    data: allTestimonials,
    variant: "testimonial_slider"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "testimonial_highlight — featured + supporting grid",
  args: {
    data: allTestimonials,
    variant: "testimonial_highlight"
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "testimonial_featured_image — avatar feature",
  args: {
    data: allTestimonials,
    variant: "testimonial_featured_image"
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "No heading",
  args: {
    data: {
      testimonials: testimonials.slice(0, 3)
    },
    variant: "default"
  }
}`,...p.parameters?.docs?.source}}},m=[`Grid`,`QuoteCard`,`Slider`,`Highlight`,`FeaturedImage`,`NoHeading`]}))();export{f as FeaturedImage,c as Grid,d as Highlight,p as NoHeading,l as QuoteCard,u as Slider,m as __namedExportsOrder,s as default};