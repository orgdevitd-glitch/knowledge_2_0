import type { ReactNode } from "react";

import type { ContentBlock, BlockType } from "@/domain/content/blocks";
import { Callout, Prose, StepList } from "@/components/content";
import { Link } from "@/components/ui/Link";
import { EmptyState } from "@/components/ui";
import { logger } from "@/lib/logger";
import type { ArticleDetail, MaterialSummary, TocItem } from "../read-models";
import { headingAnchorForBlock } from "../mappers";
import { RichTextRenderer } from "./rich-text-renderer";
import {
  defaultMediaResolver,
  type MediaPresentation,
  type MediaPresentationResolver,
} from "./media-resolver";
import { PromptCopyButton } from "./prompt-copy-button";

import styles from "./blocks.module.css";

export type BlockRenderContext = {
  toc: TocItem[];
  promptLookup: ArticleDetail["promptLookup"];
  relatedMaterials: MaterialSummary[];
  mediaResolver?: MediaPresentationResolver;
  /** Prefetched presentations keyed by mediaId (RSC-friendly). */
  resolvedMedia?: Record<string, MediaPresentation>;
};

type BlockRenderer = (
  block: ContentBlock,
  ctx: BlockRenderContext,
) => ReactNode;

function MediaFallback({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <figure className={styles.mediaFallback} role="group" aria-label={title}>
      <p className={styles.mediaFallbackTitle}>{title}</p>
      {description ? <p className={styles.mediaFallbackBody}>{description}</p> : null}
      <p className={styles.mediaFallbackHint}>
        Медиафайл будет доступен после подключения хранилища.
      </p>
    </figure>
  );
}

const renderers: { [K in BlockType]: BlockRenderer } = {
  heading(block, ctx) {
    if (block.type !== "heading") return null;
    const anchor = headingAnchorForBlock(block, ctx.toc) ?? block.id;
    const Tag = `h${block.data.level}` as "h2" | "h3" | "h4";
    return (
      <Tag id={anchor} className={styles.heading}>
        {block.data.text}
      </Tag>
    );
  },

  paragraph(block) {
    if (block.type !== "paragraph") return null;
    return (
      <p className={styles.paragraph}>
        <RichTextRenderer document={block.data.content} />
      </p>
    );
  },

  list(block) {
    if (block.type !== "list") return null;
    const List = block.data.style === "ordered" ? "ol" : "ul";
    return (
      <List className={styles.list}>
        {block.data.items.map((item, i) => (
          <li key={`${block.id}-${i}`}>{item}</li>
        ))}
      </List>
    );
  },

  table(block) {
    if (block.type !== "table") return null;
    return (
      <figure className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {block.data.columns.map((col, i) => (
                <th key={`${block.id}-c-${i}`} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.data.rows.map((row, ri) => (
              <tr key={`${block.id}-r-${ri}`}>
                {row.map((cell, ci) => (
                  <td key={`${block.id}-r-${ri}-c-${ci}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.data.caption ? (
          <figcaption>{block.data.caption}</figcaption>
        ) : null}
      </figure>
    );
  },

  image(block, ctx) {
    if (block.type !== "image") return null;
    const presentation = ctx.resolvedMedia?.[block.data.mediaId];
    if (presentation?.status === "ready") {
      const alt = block.data.decorative
        ? ""
        : block.data.alt || presentation.defaultAltText || presentation.title;
      return (
        <figure className={styles.mediaFigure}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={presentation.url}
            alt={alt}
            className={styles.mediaImage}
          />
          {block.data.caption ? (
            <figcaption>{block.data.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    return (
      <MediaFallback
        title={block.data.decorative ? "Изображение" : block.data.alt}
        description={block.data.caption}
      />
    );
  },

  gallery(block, ctx) {
    if (block.type !== "gallery") return null;
    return (
      <div className={styles.gallery}>
        {block.data.items.map((item, i) => {
          const presentation = ctx.resolvedMedia?.[item.mediaId];
          if (presentation?.status === "ready") {
            const alt = item.decorative
              ? ""
              : item.alt || presentation.defaultAltText || presentation.title;
            return (
              <figure key={`${block.id}-${i}`} className={styles.mediaFigure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={presentation.url}
                  alt={alt}
                  className={styles.mediaImage}
                />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            );
          }
          return (
            <MediaFallback
              key={`${block.id}-${i}`}
              title={item.decorative ? "Изображение галереи" : item.alt}
              description={item.caption}
            />
          );
        })}
      </div>
    );
  },

  video(block) {
    if (block.type !== "video") return null;
    return <MediaFallback title={block.data.title} description="Видео" />;
  },

  file(block, ctx) {
    if (block.type !== "file") return null;
    const presentation = ctx.resolvedMedia?.[block.data.mediaId];
    if (presentation?.status === "ready") {
      return (
        <p className={styles.blockAction}>
          <a href={presentation.url} download>
            {block.data.title}
          </a>
          {block.data.description ? (
            <span className={styles.mediaFallbackBody}>
              {" "}
              — {block.data.description}
            </span>
          ) : null}
        </p>
      );
    }
    return (
      <MediaFallback
        title={block.data.title}
        description={block.data.description}
      />
    );
  },

  button(block) {
    if (block.type !== "button") return null;
    const external = block.data.href.startsWith("http");
    return (
      <p className={styles.blockAction}>
        <Link
          href={block.data.href}
          variant="standalone"
          {...(external || block.data.openInNewTab
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {block.data.label}
        </Link>
      </p>
    );
  },

  link(block) {
    if (block.type !== "link") return null;
    const external = block.data.linkType === "external";
    return (
      <p>
        <Link
          href={block.data.href}
          variant="standalone"
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {block.data.label}
        </Link>
      </p>
    );
  },

  quote(block) {
    if (block.type !== "quote") return null;
    return (
      <blockquote className={styles.quote}>
        <p>{block.data.text}</p>
        {block.data.attribution ? (
          <footer>{block.data.attribution}</footer>
        ) : null}
      </blockquote>
    );
  },

  info(block) {
    if (block.type !== "info") return null;
    return (
      <Callout variant="information" title={block.data.title ?? "Информация"}>
        {block.data.body}
      </Callout>
    );
  },

  warning(block) {
    if (block.type !== "warning") return null;
    return (
      <Callout variant="warning" title={block.data.title ?? "Важно"}>
        {block.data.body}
      </Callout>
    );
  },

  tip(block) {
    if (block.type !== "tip") return null;
    return (
      <Callout variant="tip" title={block.data.title ?? "Совет"}>
        {block.data.body}
      </Callout>
    );
  },

  steps(block) {
    if (block.type !== "steps") return null;
    return (
      <StepList
        steps={block.data.items.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
        }))}
      />
    );
  },

  checklist(block) {
    if (block.type !== "checklist") return null;
    return (
      <ul className={styles.checklist}>
        {block.data.items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    );
  },

  faq(block) {
    if (block.type !== "faq") return null;
    return (
      <div className={styles.faq}>
        {block.data.items.map((item) => (
          <details key={item.id} className={styles.faqItem}>
            <summary>{item.question}</summary>
            <div className={styles.faqAnswer}>{item.answer}</div>
          </details>
        ))}
      </div>
    );
  },

  prompt(block, ctx) {
    if (block.type !== "prompt") return null;
    const prompt = ctx.promptLookup[block.data.promptId];
    if (!prompt) {
      return (
        <EmptyState
          title="Промт недоступен"
          description="Связанный промт скрыт или ещё не опубликован."
        />
      );
    }
    return (
      <section className={styles.promptEmbed} aria-labelledby={`pe-${block.id}`}>
        {block.data.showTitle !== false ? (
          <h3 id={`pe-${block.id}`} className={styles.promptEmbedTitle}>
            <Link href={prompt.url}>{prompt.title}</Link>
          </h3>
        ) : null}
        {prompt.summary ? (
          <p className={styles.promptEmbedSummary}>{prompt.summary}</p>
        ) : null}
        <pre className={styles.code}>{prompt.promptText}</pre>
        {block.data.showCopyButton !== false ? (
          <PromptCopyButton text={prompt.promptText} />
        ) : null}
      </section>
    );
  },

  code(block) {
    if (block.type !== "code") return null;
    return (
      <figure className={styles.codeFigure}>
        {block.data.filename ? (
          <figcaption>{block.data.filename}</figcaption>
        ) : null}
        <pre className={styles.code} data-language={block.data.language}>
          <code>{block.data.code}</code>
        </pre>
      </figure>
    );
  },

  "related-content"(block, ctx) {
    if (block.type !== "related-content") return null;
    const ids = new Set(
      block.data.items.map((i) => `${i.entityType}:${i.entityId}`),
    );
    const items = ctx.relatedMaterials.filter((m) =>
      ids.has(`${m.type}:${m.id}`),
    );
    if (!items.length) return null;
    return (
      <aside className={styles.related} aria-label="Связанные материалы">
        <h2 className={styles.relatedTitle}>Связанные материалы</h2>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.url}>{item.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
    );
  },

  divider() {
    return <hr className={styles.divider} />;
  },

  "table-of-contents"(block, ctx) {
    if (block.type !== "table-of-contents") return null;
    let items = ctx.toc;
    if (block.data.mode === "anchors") {
      const allowed = new Set(block.data.anchors);
      items = items.filter((t) => allowed.has(t.anchor));
    }
    if (!items.length) return null;
    return (
      <nav className={styles.tocBlock} aria-label="Содержание">
        <h2 className={styles.relatedTitle}>Содержание</h2>
        <ol>
          {items.map((item) => (
            <li
              key={item.id}
              style={{ marginInlineStart: `${(item.level - 2) * 0.75}rem` }}
            >
              <a href={`#${item.anchor}`}>{item.text}</a>
            </li>
          ))}
        </ol>
      </nav>
    );
  },
};

export function renderContentBlock(
  block: ContentBlock,
  ctx: BlockRenderContext,
): ReactNode {
  const renderer = renderers[block.type];
  if (!renderer) {
    logger.warn("unknown block type at render time", { type: block.type });
    return null;
  }
  return (
    <div
      key={block.id}
      className={styles.block}
      data-block-type={block.type}
      data-block-id={block.id}
    >
      {renderer(block, {
        ...ctx,
        mediaResolver: ctx.mediaResolver ?? defaultMediaResolver,
      })}
    </div>
  );
}

export function ArticleBlocks({
  blocks,
  ctx,
}: {
  blocks: ContentBlock[];
  ctx: BlockRenderContext;
}) {
  return (
    <Prose>
      {blocks.map((block) => renderContentBlock(block, ctx))}
    </Prose>
  );
}

export function listRegisteredBlockTypes(): BlockType[] {
  return Object.keys(renderers) as BlockType[];
}
