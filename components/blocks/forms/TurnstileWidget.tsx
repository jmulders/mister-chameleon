"use client";

/**
 * TurnstileWidget
 *
 * Renders a Cloudflare Turnstile CAPTCHA widget for a tenant form. Loads the
 * Turnstile API once (explicit render) and mounts the widget, which injects a
 * hidden `cf-turnstile-response` input that the form submit reads. Shared by
 * FormSectionBlock (full forms) and NewsletterForm (cta_newsletter), so the
 * Turnstile handling is not duplicated.
 *
 * Renders nothing when `siteKey` is absent (form has no Turnstile).
 */

import { useEffect, useRef } from "react";

export function TurnstileWidget({ siteKey, className }: { siteKey?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const el = ref.current;
    let cancelled = false;
    type TurnstileApi = { render: (e: HTMLElement, o: { sitekey: string }) => void };
    const w = window as unknown as {
      turnstile?:    TurnstileApi;
      __mcTsQueue?:  Array<() => void>;
      __mcTsLoading?: boolean;
      __mcTsOnload?: () => void;
    };
    const render = () => {
      if (cancelled || !w.turnstile?.render) return;
      if (el.getAttribute("data-mc-rendered")) return;
      try {
        w.turnstile.render(el, { sitekey: siteKey });
        el.setAttribute("data-mc-rendered", "1");
      } catch { /* ignore a bad widget */ }
    };
    if (w.turnstile?.render) { render(); return; }
    w.__mcTsQueue = w.__mcTsQueue ?? [];
    w.__mcTsQueue.push(render);
    if (!w.__mcTsLoading) {
      w.__mcTsLoading = true;
      w.__mcTsOnload = () => {
        const q = w.__mcTsQueue ?? [];
        w.__mcTsQueue = [];
        q.forEach((fn) => { try { fn(); } catch { /* noop */ } });
      };
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__mcTsOnload&render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    return () => { cancelled = true; };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className={className} />;
}
