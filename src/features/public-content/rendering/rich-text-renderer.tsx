import type { ReactNode } from "react";

import type {
  RichTextDocument,
  RichTextMark,
  RichTextNode,
} from "@/domain/shared/rich-text";
import { logger } from "@/lib/logger";

const MAX_DEPTH = 8;

function renderMarks(
  text: string,
  marks: RichTextMark[] | undefined,
  key: string,
): ReactNode {
  let node: ReactNode = text;
  if (!marks?.length) {
    return <span key={key}>{node}</span>;
  }

  for (const mark of marks) {
    if (mark.type === "bold") {
      node = <strong key={`${key}-b`}>{node}</strong>;
    } else if (mark.type === "italic") {
      node = <em key={`${key}-i`}>{node}</em>;
    } else if (mark.type === "code") {
      node = <code key={`${key}-c`}>{node}</code>;
    } else if (mark.type === "link") {
      const href = mark.href;
      const external = href.startsWith("http");
      node = (
        <a
          key={`${key}-a`}
          href={href}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {node}
        </a>
      );
    }
  }
  return <span key={key}>{node}</span>;
}

function renderNode(node: RichTextNode, depth: number, key: string): ReactNode {
  if (depth > MAX_DEPTH) {
    logger.warn("rich text depth limit exceeded");
    return null;
  }
  if (node.type === "line-break") {
    return <br key={key} />;
  }
  if (node.type === "text") {
    return renderMarks(node.text, node.marks, key);
  }
  logger.warn("unknown rich text node type", {
    type: (node as { type: string }).type,
  });
  return null;
}

export function RichTextRenderer({
  document,
}: {
  document: RichTextDocument;
}): ReactNode {
  return (
    <>
      {document.nodes.map((node, index) =>
        renderNode(node, 0, `rt-${index}`),
      )}
    </>
  );
}
