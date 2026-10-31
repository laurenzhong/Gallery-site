import { useEffect, useState } from "react";
import type { AboutData } from "../data/stories";

const baseNavLinks = [
  { label: "Photography", href: "/#photography" },
  { label: "Balcony View", href: "/photobalcony" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
];

const previewNavLink = { label: "Photo Notes", href: "/photostory" };

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    path: "M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-.96.04-1.48.2-1.83.34-.46.18-.79.4-1.13.74-.34.34-.56.67-.74 1.13-.14.35-.3.87-.34 1.83C3.13 8.48 3.13 8.85 3.13 12s0 3.52.07 4.76c.04.96.2 1.48.34 1.83.18.46.4.79.74 1.13.34.34.67.56 1.13.74.35.14.87.3 1.83.34 1.24.06 1.61.07 4.76.07s3.52 0 4.76-.07c.96-.04 1.48-.2 1.83-.34.46-.18.79-.4 1.13-.74.34-.34.56-.67.74-1.13.14-.35.3-.87.34-1.83.06-1.24.07-1.61.07-4.76s0-3.52-.07-4.76c-.04-.96-.2-1.48-.34-1.83a3.04 3.04 0 0 0-.74-1.13 3.04 3.04 0 0 0-1.13-.74c-.35-.14-.87-.3-1.83-.34-1.24-.06-1.61-.07-4.76-.07Zm0 3.06A4.94 4.94 0 1 1 7.06 12 4.94 4.94 0 0 1 12 7.06Zm0 1.8A3.14 3.14 0 1 0 15.14 12 3.14 3.14 0 0 0 12 8.86Zm5.13-2.05a1.15 1.15 0 1 1-1.15 1.15 1.15 1.15 0 0 1 1.15-1.15Z",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/",
    path: "M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26.27 26.27 0 0 0 2 12a26.27 26.27 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26.27 26.27 0 0 0 22 12a26.27 26.27 0 0 0-.4-4.8ZM10 15V9l5.2 3Z",
  },
];

function formatLastUpdate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  })
    .format(date)
    .replaceAll("-", ".");
}

function normalizeHref(label: string, value: string, href: string) {
  const trimmedHref = href.trim();
  const trimmedValue = value.trim();

  if (/^(mailto:|https?:\/\/|tel:)/i.test(trimmedHref)) {
    return trimmedHref;
  }

  if (label.toLowerCase() === "email" || trimmedHref.includes("@") || trimmedValue.includes("@")) {
    return `mailto:${trimmedHref || trimmedValue}`;
  }

  return trimmedHref || trimmedValue;
}

type FooterProps = {
  aboutData?: AboutData;
  showPreview?: boolean;
  variant?: "default" | "photo";
};

export function Footer({ aboutData, showPreview = false, variant = "default" }: FooterProps) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const year = new Date().getFullYear();
  const lastUpdate = formatLastUpdate(__LAST_UPDATE__);
  const navLinks = import.meta.env.DEV || showPreview ? [...baseNavLinks, previewNavLink] : baseNavLinks;
  const emailContact = aboutData?.contact.find((item) => item.label.toLowerCase() === "email");
  const emailHref = emailContact ? normalizeHref(emailContact.label, emailContact.value, emailContact.href) : undefined;

  return (
    <footer className={`site-footer ${variant === "photo" ? "site-footer--photo" : ""}`}>
      <div className="site-footer__inner">
        <div className="footer-brand-row">
          <p className="footer-brand">Queenstown.top</p>
          <button
            type="button"
            className={`footer-top-btn ${showTop ? "is-visible" : ""}`}
            onClick={scrollTop}
            aria-label="Back to top"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M12 4 L4 12 L6 14 L11 9 L11 20 L13 20 L13 9 L18 14 L20 12 Z"
                fill="currentColor"
              />
            </svg>
            <span>Top</span>
          </button>
        </div>

        <p className="footer-tagline">
          A quiet photography archive - landscape, harbor light, city edges, and small travel fragments.
        </p>

        <div className="footer-grid">
          <div className="footer-about">
            <h2 className="footer-label">About</h2>
            <p>
              Queenstown.top is a quiet photography archive shaped around landscape, harbor light, city edges, and small
              travel fragments. The site keeps images large, direct, and close to the rhythm of a visual notebook.
            </p>
          </div>

          <nav className="footer-column" aria-label="Site navigation">
            <h2 className="footer-label">Explore</h2>
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="footer-column">
            <h2 className="footer-label">Contact</h2>
            {emailContact && emailHref ? (
              <a href={emailHref}>{emailContact.value}</a>
            ) : (
              <a href="mailto:3552219514@qq.com">3552219514@qq.com</a>
            )}
            <p className="footer-sub">Based in Zhejiang</p>
          </div>

          <div className="footer-column">
            <h2 className="footer-label">Follow</h2>
            <ul className="footer-socials">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d={s.path} fill="currentColor" />
                    </svg>
                    <span>{s.label}</span>
                    <svg
                      className="footer-socials__arrow"
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      aria-hidden="true"
                    >
                      <path
                        d="M7 17 L17 7 M9 7 L17 7 L17 15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">© {year} Queenstown.top · All rights reserved</p>

          <div className="footer-colophon">

            <div className="footer-colophon__meta">
              <span>Built with React + Vite</span>
              <span>Last update · {lastUpdate}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
