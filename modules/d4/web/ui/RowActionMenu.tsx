"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type RowAction = {
  label: string;
  icon: ReactNode;
  href?: string;
  onSelect?: () => void;
  hidden?: boolean;
};

const MENU_WIDTH = 224;

/**
 * The single row-action pattern for D4 (reviewer note K2): the ⋮ button opens a short
 * menu of actions directly — no intermediate info panel. The menu is portalled so a
 * horizontally scrolling table cannot clip it.
 */
export function RowActionMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visible = actions.filter((action) => !action.hidden);
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) setPosition(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setPosition(null); trigger.current?.focus(); } };
    const onScroll = () => setPosition(null);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (open) { setPosition(null); return; }
    const rect = trigger.current!.getBoundingClientRect();
    const height = visible.length * 40 + 12;
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
  }

  function onMenuKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  const item = "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-ink hover:bg-primary-50 focus:bg-primary-50 focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-2";
  return <>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={toggle}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:border-primary-500 hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-primary-500">
      <MoreVertical aria-hidden="true" className="size-4" />
    </button>
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey} onClick={(event) => event.stopPropagation()}
      style={{ top: position.top, left: position.left, width: MENU_WIDTH }} className="fixed z-[70] rounded-xl border border-line bg-surface p-1.5 shadow-modal">
      {visible.map((action) => action.href
        ? <Link key={action.label} role="menuitem" href={action.href} className={item} onClick={() => setPosition(null)}>{action.icon}{action.label}</Link>
        : <button key={action.label} type="button" role="menuitem" className={item} onClick={() => { setPosition(null); action.onSelect?.(); }}>{action.icon}{action.label}</button>)}
    </div>, document.body)}
  </>;
}
