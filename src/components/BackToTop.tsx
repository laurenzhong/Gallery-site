type Props = {
  className: string;
  iconOnly?: boolean;
};

export function BackToTop({ className, iconOnly = false }: Props) {
  const arrowSize = iconOnly ? 24 : 14;

  function scrollToTop() {
    if (iconOnly) {
      document.querySelector<HTMLButtonElement>(".site-header .menu-toggle")?.focus({ preventScroll: true });
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
  }

  return (
    <button type="button" className={className} onClick={scrollToTop} aria-label="Back to top">
      <svg viewBox="0 0 24 24" width={arrowSize} height={arrowSize} aria-hidden="true">
        <path
          d="M12 4 L4 12 L6 14 L11 9 L11 20 L13 20 L13 9 L18 14 L20 12 Z"
          fill="currentColor"
          stroke={iconOnly ? "#050505" : undefined}
          strokeWidth={iconOnly ? 2.5 : undefined}
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </svg>
      {!iconOnly && <span>Top</span>}
    </button>
  );
}
