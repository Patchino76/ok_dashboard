"use client";

import { useEffect, useRef, useState } from "react";
import { vhsTagByName } from "@/lib/tags/vhs-tags";

type Tip = { x: number; y: number; name: string; desc: string; unit?: string };

const HOVER_DELAY = 1000;
const LONG_PRESS = 500;
const TOUCH_VISIBLE = 3500;

export function TagTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;
    let longPressed = false;

    const clear = () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
    const hide = () => {
      clear();
      current = null;
      setTip(null);
      setPos(null);
    };
    const find = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-tag]:not([data-tag=''])")
        : null;
    const show = (el: HTMLElement, x: number, y: number) => {
      const def = vhsTagByName[el.dataset.tag ?? ""];
      if (!def) return;
      setPos(null);
      setTip({ x, y, name: def.name, desc: def.desc, unit: def.unit });
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = find(e.target);
      if (!el || el === current) return;
      hide();
      current = el;
      const { clientX, clientY } = e;
      timer = setTimeout(() => show(el, clientX, clientY), HOVER_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = find(e.target);
      if (el && el === current && !el.contains(e.relatedTarget as Node))
        hide();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return hide();
      const el = find(e.target);
      hide();
      longPressed = false;
      if (!el) return;
      const { clientX, clientY } = e;
      timer = setTimeout(() => {
        longPressed = true;
        current = el;
        show(el, clientX, clientY);
        hideTimer = setTimeout(hide, TOUCH_VISIBLE);
      }, LONG_PRESS);
    };
    const cancelPress = () => clearTimeout(timer);
    const onClick = (e: MouseEvent) => {
      if (!longPressed) return;
      longPressed = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onContext = (e: Event) => {
      if (find(e.target) && (longPressed || timer)) e.preventDefault();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", cancelPress);
    document.addEventListener("pointercancel", hide);
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContext);
    window.addEventListener("scroll", hide, true);
    return () => {
      clear();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", cancelPress);
      document.removeEventListener("pointercancel", hide);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("contextmenu", onContext);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  useEffect(() => {
    if (!tip || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(margin, tip.x - width / 2),
      window.innerWidth - width - margin,
    );
    const above = tip.y - height - 16;
    const top = above >= margin ? above : tip.y + 22;
    setPos({ left, top });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={ref}
      role="tooltip"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      className="pointer-events-none fixed z-[100] max-w-72 rounded-lg border border-sky-300/30 bg-slate-900/95 px-2.5 py-1.5 text-xs text-slate-100 shadow-xl shadow-black/40 backdrop-blur"
    >
      <div className="font-medium leading-snug">{tip.desc}</div>
      <div className="mt-0.5 font-mono text-[10px] text-slate-400">
        {tip.name}
        {tip.unit ? ` · ${tip.unit}` : ""}
      </div>
    </div>
  );
}
