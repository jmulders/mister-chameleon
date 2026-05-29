"use client";

/**
 * useMenuState — shared hook for dropdown / flyout open-state management.
 *
 * ─── Why the "cursor crosses the gap and menu closes" bug exists ──────────────
 *
 *   Every Nav variant wraps its trigger + panel in a `<div className="relative">`.
 *   The panel is `position: absolute`, so it does NOT extend the wrapper div's
 *   bounding box — the wrapper is only as tall as the trigger button.
 *
 *   `onMouseLeave` (which maps to the DOM `mouseleave` event) fires on an element
 *   when the cursor moves to a node that is NOT a descendant of that element.
 *   Because the `mt-*` gap between the button and the panel is not covered by any
 *   descendant, moving into that gap fires `mouseleave` on the wrapper → the
 *   old `setOpen(false)` call closes the menu instantly.
 *
 * ─── Two complementary fixes ─────────────────────────────────────────────────
 *
 *   1. Close delay (CLOSE_DELAY_MS = 150 ms)
 *      `handleMouseLeave` schedules the close via setTimeout rather than calling
 *      it synchronously.  If the cursor re-enters any descendant of the wrapper
 *      (trigger, hover bridge, or panel) before the timer fires, `handleMouseEnter`
 *      calls `cancelClose()` and the menu stays open.
 *
 *   2. Hover bridge (rendered by each Nav variant when open=true)
 *      An invisible `aria-hidden` div sized to cover the gap sits at
 *      `top-full` inside the wrapper.  When the cursor moves from the button
 *      into the bridge, it is still inside a descendant of the wrapper, so
 *      `mouseleave` does NOT fire on the wrapper at all — the timer is never
 *      scheduled in the first place.
 *
 *   Together these cover every realistic cursor trajectory:
 *   • slow/diagonal movement  → bridge prevents the event entirely
 *   • very fast movement that overshoots the bridge → delay timer buys time
 *
 * ─── Keyboard accessibility ───────────────────────────────────────────────────
 *
 *   `handleKeyDown`  Escape closes the menu and returns focus to the trigger.
 *   `handleBlur`     Closes when focus leaves the entire widget (tab navigation).
 *   Opening on focus is intentionally omitted — the trigger's onClick (Enter/Space)
 *   toggles the menu for keyboard users, matching the ARIA button-menu pattern.
 */

import { useState, useRef, useCallback, useEffect } from "react";

/** Milliseconds to wait after mouseleave before closing the menu. */
const CLOSE_DELAY_MS = 150;

export interface MenuStateResult {
  open:              boolean;
  setOpen:           React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef:        React.RefObject<HTMLButtonElement | null>;
  handleMouseEnter:  () => void;
  handleMouseLeave:  () => void;
  handleBlur:        (e: React.FocusEvent) => void;
  handleKeyDown:     (e: React.KeyboardEvent) => void;
}

export function useMenuState(): MenuStateResult {
  const [open, setOpen]   = useState(false);
  const closeTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef        = useRef<HTMLButtonElement>(null);

  // Clean up any pending timer on unmount.
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  /** Schedule a close — cancelled if the cursor re-enters a descendant first. */
  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(closeMenu, CLOSE_DELAY_MS);
  }, [closeMenu]);

  /** Open immediately and cancel any pending close. */
  const handleMouseEnter = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  /** Schedule a delayed close. */
  const handleMouseLeave = scheduleClose;

  /** Close when focus leaves the entire dropdown widget (Tab navigation). */
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      closeMenu();
    }
  }, [closeMenu]);

  /** Escape: close menu and return focus to the trigger button. */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeMenu();
      triggerRef.current?.focus();
    }
  }, [closeMenu]);

  return {
    open,
    setOpen,
    triggerRef,
    handleMouseEnter,
    handleMouseLeave,
    handleBlur,
    handleKeyDown,
  };
}
