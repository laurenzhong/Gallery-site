import { useEffect, useState } from "react";

const menuItems = [
  { label: "Home", href: "/#top" },
  { label: "Photography", href: "/#photography" },
  { label: "Balcony View", href: "/photobalcony" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-is-open", menuOpen);

    return () => document.body.classList.remove("menu-is-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <>
      <header className="site-header" aria-label="Site header">
        <a className="brand-lockup" href="/" aria-label="Queenstown home">
          <span className="brand-mark" aria-hidden="true">
            <svg className="brand-mark-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="#0a0a0a"
                fillRule="evenodd"
                d="M 51 13 C 29 13 14 28 14 50 C 14 72 30 87 51 87 C 61 87 70 83 76 77 L 84 86 C 87 89 91 89 94 86 C 97 83 97 79 94 76 L 85 67 C 89 61 91 55 91 49 C 91 28 74 13 51 13 Z M 51 25 C 65 25 77 35 77 50 C 77 64 66 75 51 75 C 36 75 26 65 26 50 C 26 35 37 25 51 25 Z"
              />
              <path
                d="M 28 69 L 39 55 L 49 64 L 62 47 L 76 69 Z"
                fill="#0a0a0a"
                fillOpacity="0.16"
              />
              <path
                d="M 37 51 C 42 43 50 39 59 41"
                fill="none"
                stroke="#0a0a0a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeOpacity="0.28"
              />
              <circle cx="78" cy="78" r="3" fill="#0a0a0a" />
            </svg>
          </span>
          <span className="brand-word">
            Queenstown<em>.top</em>
          </span>
        </a>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      <div
        className="menu-overlay"
        data-open={menuOpen}
        id="site-menu"
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      >
        <nav className="menu-panel" aria-label="Menu navigation" onClick={(event) => event.stopPropagation()}>
          {menuItems.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
