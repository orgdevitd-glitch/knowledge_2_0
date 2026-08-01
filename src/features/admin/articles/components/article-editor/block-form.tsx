"use client";

import type { ContentBlock } from "@/domain/content/blocks";
import { richTextFromPlain, richTextToPlain } from "@/domain/shared/rich-text";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  NativeSelect,
  Textarea,
} from "@/components/ui";

import { newItemId } from "./block-utils";
import styles from "./editor.module.css";

export type BlockFormProps = {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
};

function TocAnchorsEditor({
  anchors,
  onChange,
}: {
  anchors: string[];
  onChange: (anchors: string[]) => void;
}) {
  return (
    <div className={styles.formSection}>
      <ul className={styles.itemList}>
        {anchors.map((anchor, idx) => (
          <li key={idx} className={styles.itemRow}>
            <Input
              label={`Якорь ${idx + 1}`}
              value={anchor}
              onChange={(e) => {
                const next = [...anchors];
                next[idx] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              size="small"
              variant="ghost"
              type="button"
              disabled={anchors.length <= 1}
              onClick={() => onChange(anchors.filter((_, i) => i !== idx))}
            >
              Удалить
            </Button>
          </li>
        ))}
      </ul>
      <Button
        size="small"
        variant="outline"
        type="button"
        onClick={() => onChange([...anchors, ""])}
      >
        Добавить якорь
      </Button>
    </div>
  );
}

function SharedSettings({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
}) {
  return (
    <div className={styles.formSection}>
      <h3 style={{ margin: 0, fontSize: "0.875rem" }}>Настройки блока</h3>
      <div className={styles.formRow}>
        <Input
          label="Якорь (anchor)"
          value={block.settings.anchor ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              settings: {
                ...block.settings,
                anchor: e.target.value || undefined,
              },
            })
          }
          description="a-z, цифры, дефисы"
        />
        <NativeSelect
          label="Видимость"
          value={block.visibility}
          onChange={(e) =>
            onChange({
              ...block,
              visibility: e.target.value as ContentBlock["visibility"],
            })
          }
          options={[
            { value: "all", label: "Все" },
            { value: "internal", label: "Только внутренние" },
          ]}
        />
      </div>
      <div className={styles.formRow}>
        <NativeSelect
          label="Отступ"
          value={block.settings.spacing ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              settings: {
                ...block.settings,
                spacing: (e.target.value || undefined) as
                  | "none"
                  | "sm"
                  | "md"
                  | "lg"
                  | undefined,
              },
            })
          }
          options={[
            { value: "", label: "По умолчанию" },
            { value: "none", label: "Нет" },
            { value: "sm", label: "Малый" },
            { value: "md", label: "Средний" },
            { value: "lg", label: "Большой" },
          ]}
        />
        <NativeSelect
          label="Ширина"
          value={block.settings.width ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              settings: {
                ...block.settings,
                width: (e.target.value || undefined) as
                  | "content"
                  | "wide"
                  | "full"
                  | undefined,
              },
            })
          }
          options={[
            { value: "", label: "По умолчанию" },
            { value: "content", label: "Контент" },
            { value: "wide", label: "Широкая" },
            { value: "full", label: "На всю ширину" },
          ]}
        />
      </div>
      <NativeSelect
        label="Выравнивание"
        value={block.settings.alignment ?? ""}
        onChange={(e) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              alignment: (e.target.value || undefined) as
                | "start"
                | "center"
                | "end"
                | undefined,
            },
          })
        }
        options={[
          { value: "", label: "По умолчанию" },
          { value: "start", label: "Слева" },
          { value: "center", label: "По центру" },
          { value: "end", label: "Справа" },
        ]}
      />
    </div>
  );
}

function MediaPlaceholder({ type }: { type: string }) {
  return (
    <Alert tone="information" title="Медиатека">
      Выбор {type} будет доступен после подключения медиатеки. Пока укажите ID
      вручную.
    </Alert>
  );
}

export function BlockForm({ block, onChange }: BlockFormProps) {
  const renderData = () => {
    switch (block.type) {
      case "heading":
        return (
          <>
            <NativeSelect
              label="Уровень"
              value={String(block.data.level)}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    level: Number(e.target.value) as 2 | 3 | 4,
                  },
                })
              }
              options={[
                { value: "2", label: "H2" },
                { value: "3", label: "H3" },
                { value: "4", label: "H4" },
              ]}
            />
            <Input
              label="Текст"
              value={block.data.text}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, text: e.target.value } })
              }
            />
          </>
        );

      case "paragraph":
        return (
          <Textarea
            label="Текст"
            description="Пока без форматирования — plain text"
            value={richTextToPlain(block.data.content)}
            onChange={(e) =>
              onChange({
                ...block,
                data: { content: richTextFromPlain(e.target.value) },
              })
            }
            rows={6}
          />
        );

      case "list":
        return (
          <>
            <NativeSelect
              label="Стиль"
              value={block.data.style}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    style: e.target.value as "ordered" | "unordered",
                  },
                })
              }
              options={[
                { value: "unordered", label: "Маркированный" },
                { value: "ordered", label: "Нумерованный" },
              ]}
            />
            <div className={styles.formSection}>
              <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Пункты</span>
              <ul className={styles.itemList}>
                {block.data.items.map((item, idx) => (
                  <li key={idx} className={styles.itemRow}>
                    <Input
                      label={`Пункт ${idx + 1}`}
                      value={item}
                      onChange={(e) => {
                        const items = [...block.data.items];
                        items[idx] = e.target.value;
                        onChange({ ...block, data: { ...block.data, items } });
                      }}
                    />
                    <div className={styles.itemRowActions}>
                      <Button
                        size="small"
                        variant="ghost"
                        type="button"
                        disabled={block.data.items.length <= 1}
                        onClick={() => {
                          const items = block.data.items.filter((_, i) => i !== idx);
                          onChange({ ...block, data: { ...block.data, items } });
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                size="small"
                variant="outline"
                type="button"
                onClick={() =>
                  onChange({
                    ...block,
                    data: { ...block.data, items: [...block.data.items, "Новый пункт"] },
                  })
                }
              >
                Добавить пункт
              </Button>
            </div>
          </>
        );

      case "table":
        return (
          <div className={styles.formSection}>
            <Input
              label="Подпись"
              value={block.data.caption ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, caption: e.target.value || undefined },
                })
              }
            />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Колонки</span>
            <ul className={styles.itemList}>
              {block.data.columns.map((col, idx) => (
                <li key={idx} className={styles.itemRow}>
                  <Input
                    label={`Колонка ${idx + 1}`}
                    value={col}
                    onChange={(e) => {
                      const columns = [...block.data.columns];
                      columns[idx] = e.target.value;
                      onChange({ ...block, data: { ...block.data, columns } });
                    }}
                  />
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    disabled={block.data.columns.length <= 1}
                    onClick={() => {
                      const columns = block.data.columns.filter((_, i) => i !== idx);
                      const rows = block.data.rows.map((row) =>
                        row.filter((_, i) => i !== idx),
                      );
                      onChange({ ...block, data: { ...block.data, columns, rows } });
                    }}
                  >
                    Удалить колонку
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    columns: [...block.data.columns, `Колонка ${block.data.columns.length + 1}`],
                    rows: block.data.rows.map((row) => [...row, ""]),
                  },
                })
              }
            >
              Добавить колонку
            </Button>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Строки</span>
            <ul className={styles.itemList}>
              {block.data.rows.map((row, rowIdx) => (
                <li key={rowIdx} className={styles.itemRow}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                    Строка {rowIdx + 1}
                  </span>
                  {row.map((cell, colIdx) => (
                    <Input
                      key={colIdx}
                      label={block.data.columns[colIdx] ?? `Ячейка ${colIdx + 1}`}
                      value={cell}
                      onChange={(e) => {
                        const rows = block.data.rows.map((r, ri) =>
                          ri === rowIdx
                            ? r.map((c, ci) => (ci === colIdx ? e.target.value : c))
                            : r,
                        );
                        onChange({ ...block, data: { ...block.data, rows } });
                      }}
                    />
                  ))}
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      const rows = block.data.rows.filter((_, i) => i !== rowIdx);
                      onChange({ ...block, data: { ...block.data, rows } });
                    }}
                  >
                    Удалить строку
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    rows: [
                      ...block.data.rows,
                      block.data.columns.map(() => ""),
                    ],
                  },
                })
              }
            >
              Добавить строку
            </Button>
          </div>
        );

      case "quote":
        return (
          <>
            <Textarea
              label="Текст цитаты"
              value={block.data.text}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, text: e.target.value } })
              }
              rows={4}
            />
            <Input
              label="Автор"
              value={block.data.attribution ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, attribution: e.target.value || undefined },
                })
              }
            />
          </>
        );

      case "info":
      case "warning":
      case "tip":
        return (
          <>
            <Input
              label="Заголовок"
              value={block.data.title ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, title: e.target.value || undefined },
                })
              }
            />
            <Textarea
              label="Текст"
              value={block.data.body}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, body: e.target.value } })
              }
              rows={4}
            />
          </>
        );

      case "steps":
        return (
          <div className={styles.formSection}>
            <ul className={styles.itemList}>
              {block.data.items.map((item, idx) => (
                <li key={item.id} className={styles.itemRow}>
                  <Input
                    label={`Шаг ${idx + 1}: заголовок`}
                    value={item.title}
                    onChange={(e) => {
                      const items = block.data.items.map((s) =>
                        s.id === item.id ? { ...s, title: e.target.value } : s,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Textarea
                    label="Описание"
                    value={item.description}
                    onChange={(e) => {
                      const items = block.data.items.map((s) =>
                        s.id === item.id ? { ...s, description: e.target.value } : s,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                    rows={3}
                  />
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    disabled={block.data.items.length <= 1}
                    onClick={() => {
                      const items = block.data.items.filter((s) => s.id !== item.id);
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  >
                    Удалить шаг
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    items: [
                      ...block.data.items,
                      {
                        id: newItemId("step"),
                        title: `Шаг ${block.data.items.length + 1}`,
                        description: "",
                      },
                    ],
                  },
                })
              }
            >
              Добавить шаг
            </Button>
          </div>
        );

      case "checklist":
        return (
          <div className={styles.formSection}>
            <ul className={styles.itemList}>
              {block.data.items.map((item, idx) => (
                <li key={item.id} className={styles.itemRow}>
                  <Input
                    label={`Пункт ${idx + 1}`}
                    value={item.text}
                    onChange={(e) => {
                      const items = block.data.items.map((c) =>
                        c.id === item.id ? { ...c, text: e.target.value } : c,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    disabled={block.data.items.length <= 1}
                    onClick={() => {
                      const items = block.data.items.filter((c) => c.id !== item.id);
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  >
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    items: [
                      ...block.data.items,
                      { id: newItemId("chk"), text: "Новый пункт" },
                    ],
                  },
                })
              }
            >
              Добавить пункт
            </Button>
          </div>
        );

      case "faq":
        return (
          <div className={styles.formSection}>
            <ul className={styles.itemList}>
              {block.data.items.map((item, idx) => (
                <li key={item.id} className={styles.itemRow}>
                  <Input
                    label={`Вопрос ${idx + 1}`}
                    value={item.question}
                    onChange={(e) => {
                      const items = block.data.items.map((f) =>
                        f.id === item.id ? { ...f, question: e.target.value } : f,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Textarea
                    label="Ответ"
                    value={item.answer}
                    onChange={(e) => {
                      const items = block.data.items.map((f) =>
                        f.id === item.id ? { ...f, answer: e.target.value } : f,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                    rows={3}
                  />
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    disabled={block.data.items.length <= 1}
                    onClick={() => {
                      const items = block.data.items.filter((f) => f.id !== item.id);
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  >
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    items: [
                      ...block.data.items,
                      {
                        id: newItemId("faq"),
                        question: "Новый вопрос?",
                        answer: "",
                      },
                    ],
                  },
                })
              }
            >
              Добавить вопрос
            </Button>
          </div>
        );

      case "prompt":
        return (
          <>
            <Input
              label="ID промта"
              value={block.data.promptId}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, promptId: e.target.value },
                })
              }
            />
            <Checkbox
              label="Показывать заголовок"
              checked={block.data.showTitle}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, showTitle: e.target.checked },
                })
              }
            />
            <Checkbox
              label="Кнопка копирования"
              checked={block.data.showCopyButton}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, showCopyButton: e.target.checked },
                })
              }
            />
          </>
        );

      case "code":
        return (
          <>
            <div className={styles.formRow}>
              <Input
                label="Язык"
                value={block.data.language}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, language: e.target.value },
                  })
                }
              />
              <Input
                label="Имя файла"
                value={block.data.filename ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    data: { ...block.data, filename: e.target.value || undefined },
                  })
                }
              />
            </div>
            <Textarea
              label="Код"
              value={block.data.code}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, code: e.target.value } })
              }
              rows={8}
              style={{ fontFamily: "monospace" }}
            />
          </>
        );

      case "related-content":
        return (
          <div className={styles.formSection}>
            <ul className={styles.itemList}>
              {block.data.items.map((item, idx) => (
                <li key={idx} className={styles.itemRow}>
                  <NativeSelect
                    label="Тип"
                    value={item.entityType}
                    onChange={(e) => {
                      const items = block.data.items.map((r, i) =>
                        i === idx
                          ? {
                              ...r,
                              entityType: e.target.value as
                                | "article"
                                | "prompt"
                                | "video",
                            }
                          : r,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                    options={[
                      { value: "article", label: "Статья" },
                      { value: "prompt", label: "Промт" },
                      { value: "video", label: "Видео" },
                    ]}
                  />
                  <Input
                    label="ID сущности"
                    value={item.entityId}
                    onChange={(e) => {
                      const items = block.data.items.map((r, i) =>
                        i === idx ? { ...r, entityId: e.target.value } : r,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    disabled={block.data.items.length <= 1}
                    onClick={() => {
                      const items = block.data.items.filter((_, i) => i !== idx);
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  >
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    items: [
                      ...block.data.items,
                      { entityType: "article" as const, entityId: "" },
                    ],
                  },
                })
              }
            >
              Добавить ссылку
            </Button>
          </div>
        );

      case "divider":
        return (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
            Разделитель не имеет содержимого.
          </p>
        );

      case "table-of-contents":
        return (
          <>
            <NativeSelect
              label="Режим"
              value={block.data.mode}
              onChange={(e) => {
                if (e.target.value === "auto") {
                  onChange({ ...block, data: { mode: "auto" } });
                } else {
                  onChange({
                    ...block,
                    data: { mode: "anchors", anchors: [""] },
                  });
                }
              }}
              options={[
                { value: "auto", label: "Автоматически" },
                { value: "anchors", label: "По якорям" },
              ]}
            />
            {block.data.mode === "anchors" ? (
              <TocAnchorsEditor
                anchors={block.data.anchors}
                onChange={(anchors) =>
                  onChange({ ...block, data: { mode: "anchors", anchors } })
                }
              />
            ) : null}
          </>
        );

      case "button":
        return (
          <>
            <Input
              label="Подпись"
              value={block.data.label}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, label: e.target.value } })
              }
            />
            <Input
              label="Ссылка"
              value={block.data.href}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, href: e.target.value } })
              }
            />
            <NativeSelect
              label="Вариант"
              value={block.data.variant}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    variant: e.target.value as "primary" | "secondary" | "ghost",
                  },
                })
              }
              options={[
                { value: "primary", label: "Primary" },
                { value: "secondary", label: "Secondary" },
                { value: "ghost", label: "Ghost" },
              ]}
            />
            <Checkbox
              label="Открывать в новой вкладке"
              checked={block.data.openInNewTab}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, openInNewTab: e.target.checked },
                })
              }
            />
          </>
        );

      case "link":
        return (
          <>
            <Input
              label="Подпись"
              value={block.data.label}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, label: e.target.value } })
              }
            />
            <Input
              label="URL"
              value={block.data.href}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, href: e.target.value } })
              }
            />
            <NativeSelect
              label="Тип ссылки"
              value={block.data.linkType}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    linkType: e.target.value as "internal" | "external",
                  },
                })
              }
              options={[
                { value: "internal", label: "Внутренняя" },
                { value: "external", label: "Внешняя (HTTPS)" },
              ]}
            />
          </>
        );

      case "image":
        return (
          <>
            <MediaPlaceholder type="изображения" />
            <Input
              label="Media ID"
              value={block.data.mediaId}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, mediaId: e.target.value },
                })
              }
            />
            <Input
              label="Alt-текст"
              value={block.data.alt}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, alt: e.target.value } })
              }
            />
            <Input
              label="Подпись"
              value={block.data.caption ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, caption: e.target.value || undefined },
                })
              }
            />
            <Checkbox
              label="Декоративное (без alt)"
              checked={block.data.decorative}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, decorative: e.target.checked },
                })
              }
            />
          </>
        );

      case "gallery":
        return (
          <div className={styles.formSection}>
            <MediaPlaceholder type="галереи" />
            <ul className={styles.itemList}>
              {block.data.items.map((item, idx) => (
                <li key={idx} className={styles.itemRow}>
                  <Input
                    label={`Media ID ${idx + 1}`}
                    value={item.mediaId}
                    onChange={(e) => {
                      const items = block.data.items.map((img, i) =>
                        i === idx ? { ...img, mediaId: e.target.value } : img,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Input
                    label="Alt"
                    value={item.alt}
                    onChange={(e) => {
                      const items = block.data.items.map((img, i) =>
                        i === idx ? { ...img, alt: e.target.value } : img,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Checkbox
                    label="Декоративное"
                    checked={item.decorative}
                    onChange={(e) => {
                      const items = block.data.items.map((img, i) =>
                        i === idx ? { ...img, decorative: e.target.checked } : img,
                      );
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  />
                  <Button
                    size="small"
                    variant="ghost"
                    type="button"
                    disabled={block.data.items.length <= 1}
                    onClick={() => {
                      const items = block.data.items.filter((_, i) => i !== idx);
                      onChange({ ...block, data: { ...block.data, items } });
                    }}
                  >
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="small"
              variant="outline"
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    items: [
                      ...block.data.items,
                      { mediaId: "", alt: "", decorative: true },
                    ],
                  },
                })
              }
            >
              Добавить изображение
            </Button>
          </div>
        );

      case "video":
        return (
          <>
            <MediaPlaceholder type="видео" />
            <Input
              label="Заголовок"
              value={block.data.title}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, title: e.target.value } })
              }
            />
            <Input
              label="Media ID"
              value={block.data.mediaId ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    mediaId: e.target.value || undefined,
                  },
                })
              }
            />
            <Input
              label="Video ID"
              value={block.data.videoId ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    videoId: e.target.value || undefined,
                  },
                })
              }
            />
          </>
        );

      case "file":
        return (
          <>
            <MediaPlaceholder type="файла" />
            <Input
              label="Media ID"
              value={block.data.mediaId}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, mediaId: e.target.value },
                })
              }
            />
            <Input
              label="Название"
              value={block.data.title}
              onChange={(e) =>
                onChange({ ...block, data: { ...block.data, title: e.target.value } })
              }
            />
            <Textarea
              label="Описание"
              value={block.data.description ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  data: { ...block.data, description: e.target.value || undefined },
                })
              }
              rows={3}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.formSection}>
      {renderData()}
      <SharedSettings block={block} onChange={onChange} />
    </div>
  );
}
