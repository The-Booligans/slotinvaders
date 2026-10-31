"use client";

import { useEffect, useState } from "react";

/** Nav items shown both in the desktop header and in the mobile burger panel. */
const NAV = [
  { href: "#features", label: "Features" },
  { href: "#device", label: "Device" },
  { href: "#architecture", label: "Architecture" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#privacy", label: "Privacy" },
  { href: "#try", label: "Try it" },
  { href: "#team", label: "Team" },
  { href: "https://github.com/The-Booligans/slotinvaders", label: "GitHub" },
];

/**
 * Mobile-only burger button. Collapsed state is the classic three bars; open
 * state morphs into a green pixel Space Invader (the brand mark). Toggling
 * opens a full-page nav panel beneath the sticky header.
 */
export function BurgerNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`burger-btn${open ? " burger-btn--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        {/* Three bars (default state) */}
        <svg
          className="burger-bars"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
        {/* Pixel Space Invader (open state) */}
        <svg
          className="burger-invader"
          viewBox="0 0 33 24"
          aria-hidden="true"
          focusable="false"
        >
          <g fill="#22c55e">
            <rect x="6" y="0" width="3" height="3" />
            <rect x="24" y="0" width="3" height="3" />
            <rect x="9" y="3" width="3" height="3" />
            <rect x="21" y="3" width="3" height="3" />
            <rect x="6" y="6" width="21" height="3" />
            <rect x="3" y="9" width="6" height="3" />
            <rect x="12" y="9" width="9" height="3" />
            <rect x="24" y="9" width="6" height="3" />
            <rect x="0" y="12" width="33" height="3" />
            <rect x="0" y="15" width="3" height="3" />
            <rect x="6" y="15" width="21" height="3" />
            <rect x="30" y="15" width="3" height="3" />
            <rect x="0" y="18" width="3" height="3" />
            <rect x="6" y="18" width="3" height="3" />
            <rect x="24" y="18" width="3" height="3" />
            <rect x="30" y="18" width="3" height="3" />
            <rect x="9" y="21" width="6" height="3" />
            <rect x="18" y="21" width="6" height="3" />
          </g>
        </svg>
      </button>

      <div
        id="mobile-menu"
        className={`mobile-menu${open ? " mobile-menu--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!open}
      >
        <nav className="mobile-menu__nav" aria-label="Primary mobile">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
