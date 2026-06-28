import{n as e}from"./chunk-vNrZSFDR.js";import{n as t,t as n}from"./FormSectionBlock-rHvEIQfI.js";var r,i,a,o,s,c,l,u;e((()=>{t(),r={formKey:`contact`,title:`Get in touch`,intro:`Fill in the form and we will get back to you within one business day.`,submitLabel:`Send message`,successMessage:`Thanks — your message has been sent!`},i={title:`Blocks/Sections/FormSection`,component:n,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`Platform-driven form section. The field structure, validation, and routing come from the registered FormDefinition. Variants control the section wrapper style.`}}}},a={name:`default — subtle bg, border separator`,args:{data:r,variant:`default`}},o={name:`card — form inside elevated card`,args:{data:{...r,title:`Book a demo`,intro:`Tell us a bit about your project and we will set up a 30-minute call.`},variant:`card`}},s={name:`minimal — no section bg (for embedding in article content)`,args:{data:{...r,title:`Leave a comment`,intro:void 0},variant:`minimal`}},c={name:`form_split — intro left, form right`,args:{data:{formKey:`contact`,title:`Start a conversation`,intro:`Whether you have a question, a brief, or just want to explore what we can build together — we read every message.`,submitLabel:`Send`},variant:`form_split`}},l={name:`application form (card variant)`,args:{data:{formKey:`application`,title:`Apply now`,intro:`Complete the form below to submit your application.`,submitLabel:`Submit application`},variant:`card`}},a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  name: "default — subtle bg, border separator",
  args: {
    data: contactData,
    variant: "default"
  }
}`,...a.parameters?.docs?.source}}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  name: "card — form inside elevated card",
  args: {
    data: {
      ...contactData,
      title: "Book a demo",
      intro: "Tell us a bit about your project and we will set up a 30-minute call."
    },
    variant: "card"
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: "minimal — no section bg (for embedding in article content)",
  args: {
    data: {
      ...contactData,
      title: "Leave a comment",
      intro: undefined
    },
    variant: "minimal"
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: "form_split — intro left, form right",
  args: {
    data: {
      formKey: "contact",
      title: "Start a conversation",
      intro: "Whether you have a question, a brief, or just want to explore what we can build together — we read every message.",
      submitLabel: "Send"
    },
    variant: "form_split"
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: "application form (card variant)",
  args: {
    data: {
      formKey: "application",
      title: "Apply now",
      intro: "Complete the form below to submit your application.",
      submitLabel: "Submit application"
    },
    variant: "card"
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`,`Card`,`Minimal`,`Split`,`ApplicationForm`]}))();export{l as ApplicationForm,o as Card,a as Default,s as Minimal,c as Split,u as __namedExportsOrder,i as default};