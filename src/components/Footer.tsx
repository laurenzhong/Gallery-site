import { useEffect, useRef, useState } from "react";
import { aboutData as defaultAboutData, type AboutData } from "../data/stories";

import { siteNavLinks } from "../lib/siteNavigation";

const previewNavLink = { label: "Photo Notes", href: "/photostory" };

const socials = [
  {
    label: "Instagram",
    path: "M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-.96.04-1.48.2-1.83.34-.46.18-.79.4-1.13.74-.34.34-.56.67-.74 1.13-.14.35-.3.87-.34 1.83C3.13 8.48 3.13 8.85 3.13 12s0 3.52.07 4.76c.04.96.2 1.48.34 1.83.18.46.4.79.74 1.13.34.34.67.56 1.13.74.35.14.87.3 1.83.34 1.24.06 1.61.07 4.76.07s3.52 0 4.76-.07c.96-.04 1.48-.2 1.83-.34.46-.18.79-.4 1.13-.74.34-.34.56-.67.74-1.13.14-.35.3-.87.34-1.83.06-1.24.07-1.61.07-4.76s0-3.52-.07-4.76c-.04-.96-.2-1.48-.34-1.83a3.04 3.04 0 0 0-.74-1.13 3.04 3.04 0 0 0-1.13-.74c-.35-.14-.87-.3-1.83-.34-1.24-.06-1.61-.07-4.76-.07Zm0 3.06A4.94 4.94 0 1 1 7.06 12 4.94 4.94 0 0 1 12 7.06Zm0 1.8A3.14 3.14 0 1 0 15.14 12 3.14 3.14 0 0 0 12 8.86Zm5.13-2.05a1.15 1.15 0 1 1-1.15 1.15 1.15 1.15 0 0 1 1.15-1.15Z",
  },
  {
    label: "Facebook",
    path: "M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.93-1.956 1.884v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z",
  },
  {
    label: "YouTube",
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
  deferPhoto?: boolean;
};

export function Footer({ aboutData = defaultAboutData, showPreview = false, variant = "default", deferPhoto = false }: FooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [photoInView, setPhotoInView] = useState(false);
  const photoDeferred = variant === "photo" && deferPhoto && !photoInView && typeof IntersectionObserver !== "undefined";

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || !photoDeferred) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPhotoInView(true);
        observer.disconnect();
      }
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [photoDeferred]);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const year = new Date().getFullYear();
  const lastUpdate = formatLastUpdate(__LAST_UPDATE__);
  const navLinks = import.meta.env.DEV || showPreview ? [...siteNavLinks, previewNavLink] : siteNavLinks;
  const emailContacts = aboutData.contact.filter(
    ({ label, href }) => label.trim().toLowerCase() === "email" || /^mailto:/i.test(href.trim()),
  );
  const whatsAppContact = aboutData.contact.find((item) => item.label.trim().toLowerCase() === "whatsapp");
  const followLinks = socials.flatMap((social) => {
    const contact = aboutData.contact.find((item) => item.label.trim().toLowerCase() === social.label.toLowerCase());
    return contact ? [{ ...social, href: contact.href }] : [];
  });

  return (
    <footer ref={footerRef} className={`site-footer${variant === "photo" ? " site-footer--photo" : ""}${photoDeferred ? " site-footer--photo-deferred" : ""}`}>
      <div className="site-footer__inner">
        <div className="footer-brand-row">
          <a className="footer-brand" href="/" aria-label="Queenstown home">Queenstown.top</a>
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
              {aboutData.name} often returns to familiar coastlines, harbors, and streets to photograph them in changing light.
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
            {emailContacts.length > 0 ? (
              emailContacts.map(({ label, href, value }) => (
                <a key={href} href={normalizeHref(label, value, href)}>{value}</a>
              ))
            ) : (
              <a href="mailto:3552219514@qq.com">3552219514@qq.com</a>
            )}
            {whatsAppContact && <a href={whatsAppContact.href}>WhatsApp</a>}
          </div>

          {followLinks.length > 0 && (
            <div className="footer-column">
              <h2 className="footer-label">Follow</h2>
              <ul className="footer-socials">
                {followLinks.map(({ label, href, path }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d={path} fill="currentColor" />
                      </svg>
                      <span>{label}</span>
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
          )}
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
