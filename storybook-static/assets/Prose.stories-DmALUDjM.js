import{n as e}from"./chunk-vNrZSFDR.js";import{M as t}from"./iframe-BPplKtwB.js";import{n,t as r}from"./utils-DTREARv9.js";function i({children:e,html:t,size:n=`base`,className:i,as:s=`div`}){let c=r(`prose prose-neutral max-w-none`,o[n],i);return t===void 0?(0,a.jsx)(s,{className:c,children:e}):(0,a.jsx)(s,{className:c,dangerouslySetInnerHTML:{__html:t}})}var a,o,s=e((()=>{a=t(),n(),o={sm:`prose-sm`,base:``,lg:`prose-lg`},i.__docgenInfo={description:``,methods:[],displayName:`Prose`,props:{children:{required:!1,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:`React children — component-composed rich text`},html:{required:!1,tsType:{name:`string`},description:"Raw HTML string to render.  MUST be sanitised before passing.\nWhen provided, `children` is ignored."},size:{required:!1,tsType:{name:`union`,raw:`"sm" | "base" | "lg"`,elements:[{name:`literal`,value:`"sm"`},{name:`literal`,value:`"base"`},{name:`literal`,value:`"lg"`}]},description:`Visual prose size. Defaults to "base".`,defaultValue:{value:`"base"`,computed:!1}},className:{required:!1,tsType:{name:`string`},description:`Additional CSS class names applied to the wrapper element.`},as:{required:!1,tsType:{name:`ReactElementType`,raw:`React.ElementType`},description:`Rendered element. Defaults to "div".`,defaultValue:{value:`"div"`,computed:!1}}}}})),c,l,u,d,f,p,m,h;e((()=>{c=t(),s(),l=`
<h2>Why this matters</h2>
<p>Good typography is the foundation of readable content. When text is well-set, readers don't think about the type — they just read.</p>
<p>The Prose component applies Tailwind Typography classes to consistently style headings, paragraphs, lists, blockquotes, and inline elements across the platform.</p>
<h3>Key features</h3>
<ul>
  <li>Consistent heading hierarchy (h2–h4)</li>
  <li>Comfortable line-height and paragraph spacing</li>
  <li>Styled <a href="#">inline links</a> and <strong>bold text</strong></li>
  <li>Code blocks: <code>const foo = 'bar'</code></li>
</ul>
<blockquote>
  <p>Typography is the craft of endowing human language with a durable visual form.</p>
</blockquote>
<p>Platform colours and fonts are applied via Tailwind Typography's neutral palette modifier, so tenant theme tokens take effect automatically.</p>
`,u={title:`Atoms/Prose`,component:i,tags:[`autodocs`],parameters:{docs:{description:{component:"Typography container for rich or long-form text. Applies Tailwind Typography prose classes. Accepts either React `children` (component-composed) or a sanitised `html` string from a CMS."}}},argTypes:{size:{control:`select`,options:[`sm`,`base`,`lg`]}},args:{size:`base`,html:l},decorators:[e=>(0,c.jsx)(`div`,{style:{maxWidth:`48rem`,padding:`1rem`},children:(0,c.jsx)(e,{})})]},d={},f={name:`Small (prose-sm)`,args:{size:`sm`,html:l}},p={name:`Large (prose-lg)`,args:{size:`lg`,html:l}},m={name:`Component children (not HTML string)`,args:{html:void 0},render:()=>(0,c.jsxs)(i,{children:[(0,c.jsx)(`h2`,{children:`Component-composed content`}),(0,c.jsx)(`p`,{children:`This version uses React children instead of a raw HTML string. Useful when rich text is built from components rather than CMS-rendered HTML.`}),(0,c.jsxs)(`ul`,{children:[(0,c.jsx)(`li`,{children:`Works with any React node`}),(0,c.jsx)(`li`,{children:`No sanitisation needed — no dangerouslySetInnerHTML`}),(0,c.jsx)(`li`,{children:`Picks up the same typography styles`})]})]})},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: "Small (prose-sm)",
  args: {
    size: "sm",
    html: sampleHtml
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: "Large (prose-lg)",
  args: {
    size: "lg",
    html: sampleHtml
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: "Component children (not HTML string)",
  args: {
    html: undefined
  },
  render: () => <Prose>
      <h2>Component-composed content</h2>
      <p>
        This version uses React children instead of a raw HTML string. Useful when
        rich text is built from components rather than CMS-rendered HTML.
      </p>
      <ul>
        <li>Works with any React node</li>
        <li>No sanitisation needed — no dangerouslySetInnerHTML</li>
        <li>Picks up the same typography styles</li>
      </ul>
    </Prose>
}`,...m.parameters?.docs?.source}}},h=[`Default`,`Small`,`Large`,`ComponentChildren`]}))();export{m as ComponentChildren,d as Default,p as Large,f as Small,h as __namedExportsOrder,u as default};