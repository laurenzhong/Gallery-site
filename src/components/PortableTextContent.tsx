import type { PortableTextBlock } from "../lib/cmsQueries";
import { sizedImageUrl } from "../lib/imageUrl";
import type { ReactNode } from "react";

function safeHref(value: string | undefined) {
  if (!value) return undefined;
  return /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : undefined;
}

function renderSpan(text: string, marks: string[] | undefined, markDefs: PortableTextBlock["markDefs"]) {
  let content: ReactNode = text;

  for (const mark of [...(marks ?? [])].reverse()) {
    if (mark === "strong") content = <strong>{content}</strong>;
    else if (mark === "em") content = <em>{content}</em>;
    else if (mark === "code") content = <code>{content}</code>;
    else {
      const definition = markDefs?.find((item) => item._key === mark);
      const href = safeHref(definition?.href);
      if (definition?._type === "link" && href) {
        content = (
          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
            {content}
          </a>
        );
      }
    }
  }

  return content;
}

export function PortableTextContent({ blocks, fallback = [] }: { blocks?: PortableTextBlock[]; fallback?: string[] }) {
  if (!blocks?.length) {
    return (
      <>
        {fallback.map((paragraph, index) => (
          <p key={`fallback-${index}`}>{paragraph}</p>
        ))}
      </>
    );
  }

  return (
    <>
      {blocks.map((block, index) => {
        const key = block._key ?? `block-${index}`;

        if (block._type === "image" && block.assetUrl) {
          return (
            <figure className="portable-text-image" key={key}>
              <img src={sizedImageUrl(block.assetUrl, 1800, 84)} alt={block.alt ?? ""} loading="lazy" decoding="async" />
            </figure>
          );
        }

        if (block._type !== "block") return null;

        const children = block.children?.map((child, childIndex) => (
          <span key={child._key ?? `${key}-span-${childIndex}`}>
            {renderSpan(child.text ?? "", child.marks, block.markDefs)}
          </span>
        ));

        return <p key={key}>{children}</p>;
      })}
    </>
  );
}
