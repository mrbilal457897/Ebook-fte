"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "ebook-fte-theme";

export function ThemeToggle() {
  // Starts as "dark" to match the server-rendered default. The real value is
  // read in the effect below, after hydration, because reading localStorage
  // during render would desync the server and client HTML.
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read the DOM attribute, not localStorage: the inline bootstrap script in
    // layout.tsx has already resolved the stored preference onto the element,
    // so this cannot disagree with what is currently painted. Reading storage
    // again here would be a second source of truth.
    const current =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the theme still applies for this page view.
    }
  }

  const isLight = mounted && theme === "light";

  return (
    <div className="theme-toggle">
      <button
        type="button"
        className="theme-toggle-button"
        onClick={toggle}
        aria-pressed={isLight}
        aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
        title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      >
        {/* Both icons render always; CSS picks one per theme. Swapping the
            SVG on state would remount the node and drop the CSS transition. */}
        <svg
          className="theme-toggle-icon theme-toggle-icon-moon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
        <svg
          className="theme-toggle-icon theme-toggle-icon-sun"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </button>
    </div>
  );
}
