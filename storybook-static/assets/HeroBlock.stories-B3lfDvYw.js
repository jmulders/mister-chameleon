import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./HeroBlock-CcsO7zGM.js";var r,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G;e((()=>{t(),r={title:`Blocks/Hero`,component:n,parameters:{layout:`fullscreen`,viewport:{viewports:{mobile:{name:`Mobile  (375 × 812)`,styles:{width:`375px`,height:`812px`}},tablet:{name:`Tablet  (768 × 1024)`,styles:{width:`768px`,height:`1024px`}},desktop:{name:`Desktop (1280 × 900)`,styles:{width:`1280px`,height:`900px`}}}},docs:{description:{component:"Above-the-fold hero section with eight layout variants: `hero_default` (centered, dark), `hero_split` (50/50 text+panel), `hero_proof` (centered + social-proof bar), `hero_background` (full-bleed bg media), `hero_minimal_dark` (tight dark centered — Dark AI family), `hero_split_clean` (light bg split — Clean Corporate family), `hero_dark_split` (dark bg split — Structured SaaS family), `hero_editorial` (light, typographic — Content Blog family). Supports optional image or video media (uploaded file, YouTube, or Vimeo). Mobile-first: all variants stack correctly at 375px."}}},tags:[`autodocs`]},i=[{label:`Get started free`,href:`#`,variant:`primary`},{label:`See how it works`,href:`#`,variant:`secondary`}],a=[{label:`Book a demo`,href:`#`,variant:`primary`}],o={name:`Default — text only`,args:{title:`The platform that grows with your business`,subtitle:`Streamline operations, delight customers, and scale without friction — all from one place.`,ctas:i,tag:`Now in public beta`,layoutVariant:`hero_default`}},s={name:`Split — text left, decorative panel right`,args:{title:`Clarity for every team, every sprint`,subtitle:`Stop context-switching between five tools. Bring planning, tracking, and reporting under one roof.`,ctas:i,tag:`New`,layoutVariant:`hero_split`}},c={name:`Proof — centered + social-proof bar`,args:{title:`Trusted by teams shipping faster`,subtitle:`Join thousands of teams who've cut delivery time by 40 % in their first quarter.`,ctas:a,tag:`Case studies`,layoutVariant:`hero_proof`}},l={name:`No CTAs`,args:{title:`Coming soon`,subtitle:`Something big is on its way. Leave your email and we will let you know first.`,ctas:[],layoutVariant:`hero_default`}},u={name:`No eyebrow tag`,args:{title:`Build better products, together`,subtitle:`Collaborate in real time, ship with confidence, and get instant feedback from every stakeholder.`,ctas:i,layoutVariant:`hero_default`}},d={name:`Default — with image below CTA`,args:{title:`Your dashboard. Your way.`,subtitle:`One interface for every metric that matters. Customise, share, and act — all without leaving the tab.`,ctas:i,tag:`Product`,layoutVariant:`hero_default`,media:{kind:`image`,url:`https://placehold.co/1200x675/1a1a2e/ffffff?text=Product+screenshot`,alt:`Screenshot of the product dashboard`}}},f={name:`Split — with image in right panel`,args:{title:`A picture is worth a thousand words`,subtitle:`Show your product alongside the message. The right panel automatically displays your image.`,ctas:i,tag:`New`,layoutVariant:`hero_split`,media:{kind:`image`,url:`https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image`,alt:`Product feature illustration`}}},p={name:`Proof — with image below proof bar`,args:{title:`Trusted by teams worldwide`,subtitle:`Join the companies already getting results with our platform.`,ctas:a,tag:`Social proof`,layoutVariant:`hero_proof`,media:{kind:`image`,url:`https://placehold.co/1200x675/1a1a2e/ffffff?text=Customer+success+screenshot`,alt:`Customer success dashboard`}}},m={name:`Default — with uploaded video`,args:{title:`See it in action`,subtitle:`A 60-second walkthrough of the core workflow — from setup to first result.`,ctas:a,tag:`Demo`,layoutVariant:`hero_default`,media:{kind:`video`,video:{source:`upload`,url:`https://www.w3schools.com/html/mov_bbb.mp4`,poster:`https://placehold.co/1200x675/1a1a2e/ffffff?text=Video+poster`,autoplay:!1,muted:!1,loop:!1,controls:!0}}}},h={name:`Split — with uploaded video in right panel`,args:{title:`Watch the product do the work`,subtitle:`A quick demo showing how teams go from chaos to clarity in under five minutes.`,ctas:i,tag:`Product tour`,layoutVariant:`hero_split`,media:{kind:`video`,video:{source:`upload`,url:`https://www.w3schools.com/html/mov_bbb.mp4`,poster:`https://placehold.co/800x600/1a1a2e/ffffff?text=Video+poster`,autoplay:!0,muted:!0,loop:!0,controls:!1}}}},g={name:`Default — with YouTube embed`,args:{title:`Watch our product overview`,subtitle:`A three-minute walkthrough of everything you can do from day one.`,ctas:a,tag:`Watch`,layoutVariant:`hero_default`,media:{kind:`video`,video:{source:`youtube`,videoId:`dQw4w9WgXcQ`}}}},_={name:`Split — with YouTube in right panel`,args:{title:`The story behind the product`,subtitle:`Our founders explain why we built this and what it means for your team.`,ctas:i,tag:`Our story`,layoutVariant:`hero_split`,media:{kind:`video`,video:{source:`youtube`,videoId:`dQw4w9WgXcQ`}}}},v={name:`Default — with Vimeo embed`,args:{title:`A cinematic look at what we built`,subtitle:`High-quality product film — two minutes that show the soul of the product.`,ctas:a,tag:`Film`,layoutVariant:`hero_default`,media:{kind:`video`,video:{source:`vimeo`,videoId:`76979871`}}}},y={name:`Split — with Vimeo in right panel`,args:{title:`Crafted with care`,subtitle:`We obsess over the details so your team can focus on the work that matters.`,ctas:i,tag:`Behind the scenes`,layoutVariant:`hero_split`,media:{kind:`video`,video:{source:`vimeo`,videoId:`76979871`}}}},b={name:`Background — image, center aligned`,args:{title:`Make a bold first impression`,subtitle:`A full-bleed hero with your brand imagery sets the tone before a single word is read.`,ctas:i,tag:`Visual impact`,layoutVariant:`hero_background`,contentAlign:`center`,media:{kind:`image`,url:`https://placehold.co/1920x1080/0f172a/ffffff?text=Background+image`,alt:`Hero background — decorative`}}},x={name:`Background — image, left aligned`,args:{title:`Enterprise-grade security,
startup-grade speed`,subtitle:`Deploy in minutes, scale to millions. Left-aligned content leaves room for the scene behind.`,ctas:[{label:`Start for free`,href:`#`,variant:`primary`},{label:`Talk to sales`,href:`#`,variant:`outline`}],tag:`Security`,layoutVariant:`hero_background`,contentAlign:`left`,media:{kind:`image`,url:`https://placehold.co/1920x1080/1e3a5f/ffffff?text=Background+image`,alt:`Hero background — decorative`}}},S={name:`Background — image, right aligned`,args:{title:`Ship faster.
Break nothing.`,subtitle:`Continuous deployment with automated rollbacks. Right-aligned for an editorial feel.`,ctas:[{label:`See the demo`,href:`#`,variant:`primary`}],tag:`CI/CD`,layoutVariant:`hero_background`,contentAlign:`right`,media:{kind:`image`,url:`https://placehold.co/1920x1080/1a1a2e/ffffff?text=Background+image`,alt:`Hero background — decorative`}}},C={name:`Background — uploaded video, center`,args:{title:`A living backdrop for your message`,subtitle:`Self-hosted video plays automatically and loops silently — no distractions, just atmosphere.`,ctas:i,tag:`Ambient`,layoutVariant:`hero_background`,contentAlign:`center`,media:{kind:`video`,video:{source:`upload`,url:`https://www.w3schools.com/html/mov_bbb.mp4`,poster:`https://placehold.co/1920x1080/0f172a/ffffff?text=Video+poster`,autoplay:!0,muted:!0,loop:!0,controls:!1}}}},w={name:`Background — YouTube video, center`,args:{title:`Powered by the same infrastructure
that runs the internet`,subtitle:`A YouTube video loops silently in the background using Vimeo background-mode params.`,ctas:a,tag:`Infrastructure`,layoutVariant:`hero_background`,contentAlign:`center`,media:{kind:`video`,video:{source:`youtube`,videoId:`dQw4w9WgXcQ`}}}},T={name:`Background — Vimeo video, left aligned`,args:{title:`Motion tells the story
words can't`,subtitle:`Vimeo background mode plays the video silently without controls or branding.`,ctas:[{label:`Explore the platform`,href:`#`,variant:`primary`},{label:`View pricing`,href:`#`,variant:`secondary`}],tag:`Cinematic`,layoutVariant:`hero_background`,contentAlign:`left`,media:{kind:`video`,video:{source:`vimeo`,videoId:`76979871`}}}},E={name:`Background — no media (dark brand fallback)`,args:{title:`No image? No problem.`,subtitle:`When no background media is supplied the variant falls back to a dark brand colour with the standard radial glow, keeping the layout consistent.`,ctas:i,tag:`Fallback`,layoutVariant:`hero_background`,contentAlign:`center`}},D={name:`Default — mobile (375px)`,args:{title:`The platform that grows with your business`,subtitle:`Streamline operations, delight customers, and scale without friction — all from one place.`,ctas:i,tag:`Now in public beta`,layoutVariant:`hero_default`},parameters:{viewport:{defaultViewport:`mobile`}}},O={name:`Split — image panel, mobile (375px)`,args:{title:`A picture is worth a thousand words`,subtitle:`Show your product alongside the message. On mobile the image appears below the text.`,ctas:i,tag:`New`,layoutVariant:`hero_split`,media:{kind:`image`,url:`https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image`,alt:`Product feature illustration`}},parameters:{viewport:{defaultViewport:`mobile`}}},k={name:`Split — image panel, tablet (768px)`,args:{title:`A picture is worth a thousand words`,subtitle:`Show your product alongside the message. Columns appear side-by-side from lg upward.`,ctas:i,tag:`New`,layoutVariant:`hero_split`,media:{kind:`image`,url:`https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image`,alt:`Product feature illustration`}},parameters:{viewport:{defaultViewport:`tablet`}}},A={name:`Background — image, mobile (375px)`,args:{title:`Make a bold first impression`,subtitle:`A full-bleed hero with your brand imagery sets the tone before a single word is read.`,ctas:i,tag:`Visual impact`,layoutVariant:`hero_background`,contentAlign:`center`,media:{kind:`image`,url:`https://placehold.co/1920x1080/0f172a/ffffff?text=Background+image`,alt:`Hero background — decorative`}},parameters:{viewport:{defaultViewport:`mobile`}}},j={name:`Proof — social-proof bar, mobile (375px)`,args:{title:`Trusted by teams shipping faster`,subtitle:`Join thousands of teams who've cut delivery time by 40 % in their first quarter.`,ctas:a,tag:`Case studies`,layoutVariant:`hero_proof`},parameters:{viewport:{defaultViewport:`mobile`}}},M={name:`Minimal dark — tight centered hero (Dark AI)`,args:{title:`AI that understands your product`,subtitle:`Surface the right features at the right moment — without writing a single rule by hand.`,ctas:i,tag:`Powered by GPT-4`,layoutVariant:`hero_minimal_dark`}},N={name:`Minimal dark — with product screenshot below CTA`,args:{title:`From zero to production-ready AI`,subtitle:`Connect your data, define your logic, deploy to edge. One platform — no ML team required.`,ctas:i,tag:`Developer preview`,layoutVariant:`hero_minimal_dark`,media:{kind:`image`,url:`https://placehold.co/1200x675/0a0a0f/818cf8?text=Product+screenshot`,alt:`Platform dashboard screenshot`}}},P={name:`Minimal dark — mobile (375px)`,args:{title:`AI that understands your product`,subtitle:`Surface the right features at the right moment — no rules needed.`,ctas:i,tag:`Powered by GPT-4`,layoutVariant:`hero_minimal_dark`},parameters:{viewport:{defaultViewport:`mobile`}}},F={name:`Split clean — light bg, product screenshot right (Clean Corporate)`,args:{title:`The reporting suite your finance team will actually use`,subtitle:`Crystal-clear dashboards, automated reconciliation, and audit-ready exports — all in one place.`,ctas:[{label:`Request a demo`,href:`#`,variant:`primary`},{label:`See pricing`,href:`#`,variant:`secondary`}],tag:`Enterprise ready`,layoutVariant:`hero_split_clean`,media:{kind:`image`,url:`https://placehold.co/800x600/f8fafc/334155?text=Product+screenshot`,alt:`Finance dashboard screenshot`}}},I={name:`Split clean — no media (placeholder panel)`,args:{title:`Clarity at every level of your organisation`,subtitle:`Give leadership the visibility they need, and give your team the focus they deserve.`,ctas:[{label:`Get started free`,href:`#`,variant:`primary`},{label:`Talk to sales`,href:`#`,variant:`secondary`}],tag:`B2B SaaS`,layoutVariant:`hero_split_clean`}},L={name:`Split clean — mobile (375px)`,args:{title:`The reporting suite your finance team will actually use`,subtitle:`Crystal-clear dashboards and audit-ready exports — all in one place.`,ctas:[{label:`Request a demo`,href:`#`,variant:`primary`}],tag:`Enterprise ready`,layoutVariant:`hero_split_clean`,media:{kind:`image`,url:`https://placehold.co/800x600/f8fafc/334155?text=Product+screenshot`,alt:`Finance dashboard`}},parameters:{viewport:{defaultViewport:`mobile`}}},R={name:`Dark split — dark bg, glow panel right (Structured SaaS / Dark AI)`,args:{title:`Infrastructure that scales with you`,subtitle:`From 10 to 10 million requests per day — the same code, the same API, zero rearchitecting.`,ctas:i,tag:`Globally distributed`,layoutVariant:`hero_dark_split`}},z={name:`Dark split — with media in right panel`,args:{title:`Built for the teams that can't afford downtime`,subtitle:`99.999% uptime SLA, multi-region failover, and an incident response team on call 24/7.`,ctas:[{label:`Start free trial`,href:`#`,variant:`primary`},{label:`View reliability`,href:`#`,variant:`secondary`}],tag:`Enterprise SaaS`,layoutVariant:`hero_dark_split`,media:{kind:`image`,url:`https://placehold.co/800x600/0f172a/818cf8?text=Architecture+diagram`,alt:`Multi-region architecture diagram`}}},B={name:`Dark split — mobile (375px)`,args:{title:`Infrastructure that scales with you`,subtitle:`From 10 to 10 million requests — zero rearchitecting.`,ctas:i,tag:`Globally distributed`,layoutVariant:`hero_dark_split`},parameters:{viewport:{defaultViewport:`mobile`}}},V={name:`Editorial — large type, light bg (Content Blog)`,args:{title:`Ideas worth building on`,subtitle:`In-depth articles, how-tos, and perspectives from the people shipping the platform.`,ctas:[{label:`Read the blog`,href:`#`,variant:`primary`},{label:`Subscribe to updates`,href:`#`,variant:`secondary`}],tag:`Product blog`,layoutVariant:`hero_editorial`}},H={name:`Editorial — with featured image below CTA`,args:{title:`The quiet revolution in B2B software`,subtitle:`How a generation of founders is building companies you never see on the front page — and why that matters.`,ctas:[{label:`Read the piece`,href:`#`,variant:`primary`}],tag:`Long read`,layoutVariant:`hero_editorial`,media:{kind:`image`,url:`https://placehold.co/1200x675/f8fafc/334155?text=Featured+article+image`,alt:`Abstract illustration for the featured article`}}},U={name:`Editorial — no CTAs (announcement / splash)`,args:{title:`We shipped something big today`,subtitle:`After two years of building, we're opening the platform to everyone — no waitlist, no invite code.`,ctas:[],tag:`Announcement`,layoutVariant:`hero_editorial`}},W={name:`Editorial — mobile (375px)`,args:{title:`Ideas worth building on`,subtitle:`In-depth articles, how-tos, and perspectives from the people shipping the platform.`,ctas:[{label:`Read the blog`,href:`#`,variant:`primary`}],tag:`Product blog`,layoutVariant:`hero_editorial`},parameters:{viewport:{defaultViewport:`mobile`}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  name: "Default — text only",
  args: {
    title: "The platform that grows with your business",
    subtitle: "Streamline operations, delight customers, and scale without friction — all from one place.",
    ctas: defaultCtas,
    tag: "Now in public beta",
    layoutVariant: "hero_default"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "Split — text left, decorative panel right",
  args: {
    title: "Clarity for every team, every sprint",
    subtitle: "Stop context-switching between five tools. Bring planning, tracking, and reporting under one roof.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "Proof — centered + social-proof bar",
  args: {
    title: "Trusted by teams shipping faster",
    subtitle: "Join thousands of teams who've cut delivery time by 40 % in their first quarter.",
    ctas: singleCta,
    tag: "Case studies",
    layoutVariant: "hero_proof"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "No CTAs",
  args: {
    title: "Coming soon",
    subtitle: "Something big is on its way. Leave your email and we will let you know first.",
    ctas: [],
    layoutVariant: "hero_default"
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: "No eyebrow tag",
  args: {
    title: "Build better products, together",
    subtitle: "Collaborate in real time, ship with confidence, and get instant feedback from every stakeholder.",
    ctas: defaultCtas,
    layoutVariant: "hero_default"
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: "Default — with image below CTA",
  args: {
    title: "Your dashboard. Your way.",
    subtitle: "One interface for every metric that matters. Customise, share, and act — all without leaving the tab.",
    ctas: defaultCtas,
    tag: "Product",
    layoutVariant: "hero_default",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/1a1a2e/ffffff?text=Product+screenshot",
      alt: "Screenshot of the product dashboard"
    }
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Split — with image in right panel",
  args: {
    title: "A picture is worth a thousand words",
    subtitle: "Show your product alongside the message. The right panel automatically displays your image.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image",
      alt: "Product feature illustration"
    }
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Proof — with image below proof bar",
  args: {
    title: "Trusted by teams worldwide",
    subtitle: "Join the companies already getting results with our platform.",
    ctas: singleCta,
    tag: "Social proof",
    layoutVariant: "hero_proof",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/1a1a2e/ffffff?text=Customer+success+screenshot",
      alt: "Customer success dashboard"
    }
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "Default — with uploaded video",
  args: {
    title: "See it in action",
    subtitle: "A 60-second walkthrough of the core workflow — from setup to first result.",
    ctas: singleCta,
    tag: "Demo",
    layoutVariant: "hero_default",
    media: {
      kind: "video",
      video: {
        source: "upload",
        // Replace with a real hosted video URL in production
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        poster: "https://placehold.co/1200x675/1a1a2e/ffffff?text=Video+poster",
        autoplay: false,
        muted: false,
        loop: false,
        controls: true
      }
    }
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: "Split — with uploaded video in right panel",
  args: {
    title: "Watch the product do the work",
    subtitle: "A quick demo showing how teams go from chaos to clarity in under five minutes.",
    ctas: defaultCtas,
    tag: "Product tour",
    layoutVariant: "hero_split",
    media: {
      kind: "video",
      video: {
        source: "upload",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        poster: "https://placehold.co/800x600/1a1a2e/ffffff?text=Video+poster",
        autoplay: true,
        muted: true,
        loop: true,
        controls: false
      }
    }
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: "Default — with YouTube embed",
  args: {
    title: "Watch our product overview",
    subtitle: "A three-minute walkthrough of everything you can do from day one.",
    ctas: singleCta,
    tag: "Watch",
    layoutVariant: "hero_default",
    media: {
      kind: "video",
      video: {
        source: "youtube",
        // Replace with your actual YouTube video ID
        videoId: "dQw4w9WgXcQ"
      }
    }
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: "Split — with YouTube in right panel",
  args: {
    title: "The story behind the product",
    subtitle: "Our founders explain why we built this and what it means for your team.",
    ctas: defaultCtas,
    tag: "Our story",
    layoutVariant: "hero_split",
    media: {
      kind: "video",
      video: {
        source: "youtube",
        videoId: "dQw4w9WgXcQ"
      }
    }
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: "Default — with Vimeo embed",
  args: {
    title: "A cinematic look at what we built",
    subtitle: "High-quality product film — two minutes that show the soul of the product.",
    ctas: singleCta,
    tag: "Film",
    layoutVariant: "hero_default",
    media: {
      kind: "video",
      video: {
        source: "vimeo",
        // Replace with your actual Vimeo video ID
        videoId: "76979871"
      }
    }
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: "Split — with Vimeo in right panel",
  args: {
    title: "Crafted with care",
    subtitle: "We obsess over the details so your team can focus on the work that matters.",
    ctas: defaultCtas,
    tag: "Behind the scenes",
    layoutVariant: "hero_split",
    media: {
      kind: "video",
      video: {
        source: "vimeo",
        videoId: "76979871"
      }
    }
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: "Background — image, center aligned",
  args: {
    title: "Make a bold first impression",
    subtitle: "A full-bleed hero with your brand imagery sets the tone before a single word is read.",
    ctas: defaultCtas,
    tag: "Visual impact",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/0f172a/ffffff?text=Background+image",
      alt: "Hero background — decorative"
    }
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: "Background — image, left aligned",
  args: {
    title: "Enterprise-grade security,\\nstartup-grade speed",
    subtitle: "Deploy in minutes, scale to millions. Left-aligned content leaves room for the scene behind.",
    ctas: [{
      label: "Start for free",
      href: "#",
      variant: "primary" as const
    }, {
      label: "Talk to sales",
      href: "#",
      variant: "outline" as const
    }],
    tag: "Security",
    layoutVariant: "hero_background",
    contentAlign: "left",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/1e3a5f/ffffff?text=Background+image",
      alt: "Hero background — decorative"
    }
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: "Background — image, right aligned",
  args: {
    title: "Ship faster.\\nBreak nothing.",
    subtitle: "Continuous deployment with automated rollbacks. Right-aligned for an editorial feel.",
    ctas: [{
      label: "See the demo",
      href: "#",
      variant: "primary" as const
    }],
    tag: "CI/CD",
    layoutVariant: "hero_background",
    contentAlign: "right",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/1a1a2e/ffffff?text=Background+image",
      alt: "Hero background — decorative"
    }
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: "Background — uploaded video, center",
  args: {
    title: "A living backdrop for your message",
    subtitle: "Self-hosted video plays automatically and loops silently — no distractions, just atmosphere.",
    ctas: defaultCtas,
    tag: "Ambient",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "video",
      video: {
        source: "upload",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        poster: "https://placehold.co/1920x1080/0f172a/ffffff?text=Video+poster",
        // Background videos default to autoplay + muted + loop in the component
        autoplay: true,
        muted: true,
        loop: true,
        controls: false
      }
    }
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: "Background — YouTube video, center",
  args: {
    title: "Powered by the same infrastructure\\nthat runs the internet",
    subtitle: "A YouTube video loops silently in the background using Vimeo background-mode params.",
    ctas: singleCta,
    tag: "Infrastructure",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "video",
      video: {
        source: "youtube",
        videoId: "dQw4w9WgXcQ"
      }
    }
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: "Background — Vimeo video, left aligned",
  args: {
    title: "Motion tells the story\\nwords can't",
    subtitle: "Vimeo background mode plays the video silently without controls or branding.",
    ctas: [{
      label: "Explore the platform",
      href: "#",
      variant: "primary" as const
    }, {
      label: "View pricing",
      href: "#",
      variant: "secondary" as const
    }],
    tag: "Cinematic",
    layoutVariant: "hero_background",
    contentAlign: "left",
    media: {
      kind: "video",
      video: {
        source: "vimeo",
        videoId: "76979871"
      }
    }
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: "Background — no media (dark brand fallback)",
  args: {
    title: "No image? No problem.",
    subtitle: "When no background media is supplied the variant falls back to a dark brand colour " + "with the standard radial glow, keeping the layout consistent.",
    ctas: defaultCtas,
    tag: "Fallback",
    layoutVariant: "hero_background",
    contentAlign: "center"
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: "Default — mobile (375px)",
  args: {
    title: "The platform that grows with your business",
    subtitle: "Streamline operations, delight customers, and scale without friction — all from one place.",
    ctas: defaultCtas,
    tag: "Now in public beta",
    layoutVariant: "hero_default"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: "Split — image panel, mobile (375px)",
  args: {
    title: "A picture is worth a thousand words",
    subtitle: "Show your product alongside the message. On mobile the image appears below the text.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image",
      alt: "Product feature illustration"
    }
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  name: "Split — image panel, tablet (768px)",
  args: {
    title: "A picture is worth a thousand words",
    subtitle: "Show your product alongside the message. Columns appear side-by-side from lg upward.",
    ctas: defaultCtas,
    tag: "New",
    layoutVariant: "hero_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/1a1a2e/ffffff?text=Product+image",
      alt: "Product feature illustration"
    }
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet"
    }
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  name: "Background — image, mobile (375px)",
  args: {
    title: "Make a bold first impression",
    subtitle: "A full-bleed hero with your brand imagery sets the tone before a single word is read.",
    ctas: defaultCtas,
    tag: "Visual impact",
    layoutVariant: "hero_background",
    contentAlign: "center",
    media: {
      kind: "image",
      url: "https://placehold.co/1920x1080/0f172a/ffffff?text=Background+image",
      alt: "Hero background — decorative"
    }
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  name: "Proof — social-proof bar, mobile (375px)",
  args: {
    title: "Trusted by teams shipping faster",
    subtitle: "Join thousands of teams who've cut delivery time by 40 % in their first quarter.",
    ctas: singleCta,
    tag: "Case studies",
    layoutVariant: "hero_proof"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  name: "Minimal dark — tight centered hero (Dark AI)",
  args: {
    title: "AI that understands your product",
    subtitle: "Surface the right features at the right moment — without writing a single rule by hand.",
    ctas: defaultCtas,
    tag: "Powered by GPT-4",
    layoutVariant: "hero_minimal_dark"
  }
}`,...M.parameters?.docs?.source},description:{story:`hero_minimal_dark — near-black full-width hero; centered content; tight bold
heading; narrow brand-glow line. No decorative panel.
Dark AI family signature variant.`,...M.parameters?.docs?.description}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  name: "Minimal dark — with product screenshot below CTA",
  args: {
    title: "From zero to production-ready AI",
    subtitle: "Connect your data, define your logic, deploy to edge. One platform — no ML team required.",
    ctas: defaultCtas,
    tag: "Developer preview",
    layoutVariant: "hero_minimal_dark",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/0a0a0f/818cf8?text=Product+screenshot",
      alt: "Platform dashboard screenshot"
    }
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  name: "Minimal dark — mobile (375px)",
  args: {
    title: "AI that understands your product",
    subtitle: "Surface the right features at the right moment — no rules needed.",
    ctas: defaultCtas,
    tag: "Powered by GPT-4",
    layoutVariant: "hero_minimal_dark"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  name: "Split clean — light bg, product screenshot right (Clean Corporate)",
  args: {
    title: "The reporting suite your finance team will actually use",
    subtitle: "Crystal-clear dashboards, automated reconciliation, and audit-ready exports — all in one place.",
    ctas: [{
      label: "Request a demo",
      href: "#",
      variant: "primary" as const
    }, {
      label: "See pricing",
      href: "#",
      variant: "secondary" as const
    }],
    tag: "Enterprise ready",
    layoutVariant: "hero_split_clean",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/f8fafc/334155?text=Product+screenshot",
      alt: "Finance dashboard screenshot"
    }
  }
}`,...F.parameters?.docs?.source},description:{story:`hero_split_clean — light-background split hero; dark text left;
framed product screenshot right. Clean Corporate family variant.`,...F.parameters?.docs?.description}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  name: "Split clean — no media (placeholder panel)",
  args: {
    title: "Clarity at every level of your organisation",
    subtitle: "Give leadership the visibility they need, and give your team the focus they deserve.",
    ctas: [{
      label: "Get started free",
      href: "#",
      variant: "primary" as const
    }, {
      label: "Talk to sales",
      href: "#",
      variant: "secondary" as const
    }],
    tag: "B2B SaaS",
    layoutVariant: "hero_split_clean"
  }
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  name: "Split clean — mobile (375px)",
  args: {
    title: "The reporting suite your finance team will actually use",
    subtitle: "Crystal-clear dashboards and audit-ready exports — all in one place.",
    ctas: [{
      label: "Request a demo",
      href: "#",
      variant: "primary" as const
    }],
    tag: "Enterprise ready",
    layoutVariant: "hero_split_clean",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/f8fafc/334155?text=Product+screenshot",
      alt: "Finance dashboard"
    }
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: "Dark split — dark bg, glow panel right (Structured SaaS / Dark AI)",
  args: {
    title: "Infrastructure that scales with you",
    subtitle: "From 10 to 10 million requests per day — the same code, the same API, zero rearchitecting.",
    ctas: defaultCtas,
    tag: "Globally distributed",
    layoutVariant: "hero_dark_split"
  }
}`,...R.parameters?.docs?.source},description:{story:`hero_dark_split — dark brand background + text left + vivid glow panel right.
Structured SaaS / Dark AI split entry point.`,...R.parameters?.docs?.description}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  name: "Dark split — with media in right panel",
  args: {
    title: "Built for the teams that can't afford downtime",
    subtitle: "99.999% uptime SLA, multi-region failover, and an incident response team on call 24/7.",
    ctas: [{
      label: "Start free trial",
      href: "#",
      variant: "primary" as const
    }, {
      label: "View reliability",
      href: "#",
      variant: "secondary" as const
    }],
    tag: "Enterprise SaaS",
    layoutVariant: "hero_dark_split",
    media: {
      kind: "image",
      url: "https://placehold.co/800x600/0f172a/818cf8?text=Architecture+diagram",
      alt: "Multi-region architecture diagram"
    }
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: "Dark split — mobile (375px)",
  args: {
    title: "Infrastructure that scales with you",
    subtitle: "From 10 to 10 million requests — zero rearchitecting.",
    ctas: defaultCtas,
    tag: "Globally distributed",
    layoutVariant: "hero_dark_split"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  name: "Editorial — large type, light bg (Content Blog)",
  args: {
    title: "Ideas worth building on",
    subtitle: "In-depth articles, how-tos, and perspectives from the people shipping the platform.",
    ctas: [{
      label: "Read the blog",
      href: "#",
      variant: "primary" as const
    }, {
      label: "Subscribe to updates",
      href: "#",
      variant: "secondary" as const
    }],
    tag: "Product blog",
    layoutVariant: "hero_editorial"
  }
}`,...V.parameters?.docs?.source},description:{story:`hero_editorial — light neutral section; large typographic centered heading.
Content Blog / editorial-first family variant.`,...V.parameters?.docs?.description}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  name: "Editorial — with featured image below CTA",
  args: {
    title: "The quiet revolution in B2B software",
    subtitle: "How a generation of founders is building companies you never see on the front page — and why that matters.",
    ctas: [{
      label: "Read the piece",
      href: "#",
      variant: "primary" as const
    }],
    tag: "Long read",
    layoutVariant: "hero_editorial",
    media: {
      kind: "image",
      url: "https://placehold.co/1200x675/f8fafc/334155?text=Featured+article+image",
      alt: "Abstract illustration for the featured article"
    }
  }
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  name: "Editorial — no CTAs (announcement / splash)",
  args: {
    title: "We shipped something big today",
    subtitle: "After two years of building, we're opening the platform to everyone — no waitlist, no invite code.",
    ctas: [],
    tag: "Announcement",
    layoutVariant: "hero_editorial"
  }
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: "Editorial — mobile (375px)",
  args: {
    title: "Ideas worth building on",
    subtitle: "In-depth articles, how-tos, and perspectives from the people shipping the platform.",
    ctas: [{
      label: "Read the blog",
      href: "#",
      variant: "primary" as const
    }],
    tag: "Product blog",
    layoutVariant: "hero_editorial"
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  }
}`,...W.parameters?.docs?.source}}},G=`Default.Split.Proof.NoCtas.NoTag.WithImage.SplitWithImage.ProofWithImage.WithUploadVideo.SplitWithUploadVideo.WithYouTube.SplitWithYouTube.WithVimeo.SplitWithVimeo.BackgroundImageCenter.BackgroundImageLeft.BackgroundImageRight.BackgroundVideo.BackgroundYouTube.BackgroundVimeo.BackgroundNoMedia.DefaultMobile.SplitWithImageMobile.SplitWithImageTablet.BackgroundImageMobile.ProofMobile.MinimalDark.MinimalDarkWithImage.MinimalDarkMobile.SplitClean.SplitCleanNoMedia.SplitCleanMobile.DarkSplit.DarkSplitWithMedia.DarkSplitMobile.Editorial.EditorialWithImage.EditorialNoCtas.EditorialMobile`.split(`.`)}))();export{b as BackgroundImageCenter,x as BackgroundImageLeft,A as BackgroundImageMobile,S as BackgroundImageRight,E as BackgroundNoMedia,C as BackgroundVideo,T as BackgroundVimeo,w as BackgroundYouTube,R as DarkSplit,B as DarkSplitMobile,z as DarkSplitWithMedia,o as Default,D as DefaultMobile,V as Editorial,W as EditorialMobile,U as EditorialNoCtas,H as EditorialWithImage,M as MinimalDark,P as MinimalDarkMobile,N as MinimalDarkWithImage,l as NoCtas,u as NoTag,c as Proof,j as ProofMobile,p as ProofWithImage,s as Split,F as SplitClean,L as SplitCleanMobile,I as SplitCleanNoMedia,f as SplitWithImage,O as SplitWithImageMobile,k as SplitWithImageTablet,h as SplitWithUploadVideo,y as SplitWithVimeo,_ as SplitWithYouTube,d as WithImage,m as WithUploadVideo,v as WithVimeo,g as WithYouTube,G as __namedExportsOrder,r as default};