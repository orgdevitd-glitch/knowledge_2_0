# Component Catalog — Phase 2B

Все компоненты принимают данные через props. Без Firestore / Google API / хардкода контента.

## Layout

| Component | Назначение | API (кратко) |
|-----------|------------|--------------|
| `Container` | Ширина страницы | `width: standard\|wide\|editorial\|full` |
| `Stack` | Вертикальный gap | `gap: 1–8` |
| `Inline` | Горизонтальный ряд | `gap`, `wrap`, `align`, `justify` |
| `Grid` | Адаптивная сетка | `gap`, `minItemWidth`, `columns?` |
| `Surface` | Фон поверхности | `variant: default\|muted\|dark\|accent\|information` |
| `Divider` | Разделитель | `orientation` |
| `VisuallyHidden` | SR-only текст | `children` |
| `AppHeader` | Шапка | `brand`, `search?`, `actions?`, `onOpenNavigation?` |
| `Sidebar` | Боковое меню | `groups`, `collapsed?` |
| `Breadcrumbs` | Крошки | `items[{id,label,href?}]` |
| `MobileNavigationPanel` | Mobile sheet | `open`, `onClose`, Escape + focus return |

**Нельзя:** Sidebar с реальным меню портала; panel без Escape/focus.

## UI

| Component | Варианты / размеры | Состояния | A11y |
|-----------|--------------------|-----------|------|
| `Button` | primary/secondary/outline/ghost/danger · sm/md/lg | hover/active/focus/disabled/loading | имя из children; loading → `aria-busy` |
| `IconButton` | как Button | то же | обязательный `label` |
| `Link` | inline/navigation/standalone/subtle | active | отличие не только цветом |
| `Input`/`Textarea` | — | error/disabled/readOnly | label + `aria-invalid` |
| `SearchField` | — | loading/clear | label (можно hideLabel) |
| `NativeSelect` | native | error/disabled | label |
| `Checkbox` | — | indeterminate/error | label |
| `RadioGroup` | — | error/disabled | legend |
| `Switch` | binary settings | checked/disabled | `role="switch"` |
| `Badge` | neutral/accent/info/success/warning/error | — | не кнопка |
| `Status` | success/warning/error/info | — | маркер + текст |
| `Alert` | information/success/warning/error | dismiss? | `role="status"` |
| `Card` | default/interactive/selected/disabled | — | не авто-ссылка |
| `MetadataList` | — | — | список пар |
| `EmptyState` | — | actions | заголовок |
| `Skeleton` | — | reduced motion | `role="status"` |

**Primary:** жёлтый фон + тёмный текст. **Danger:** error-токены.

## Content / Learning

| Component | Назначение | Заметки |
|-----------|------------|---------|
| `ArticleHeader` | Заголовок статьи + meta/status | Workspace meta + editorial title |
| `Prose` | Editorial reading | `.ds-prose` / Source Serif 4 |
| `Callout` | information/tip/warning/important | не всё жёлтое |
| `StepList` | Шаги инструкции | completed visual only |
| `PromptBlock` | Промт + copy callback | публичный блок в статье |
| Prompt Admin forms | create/edit/list Phase 8A | feature components under `features/admin/prompts` — не отдельный UI-kit |
| Media Admin forms | upload/list/edit Phase 7B | feature components under `features/admin/media` |
| Search experience | form, chips, result card, suggestions combobox | `features/search/ui` (Phase 8B.2); runtime `maxLength` via server props; one filter control set; unique combobox IDs per instance |
| `TableOfContents` | Список якорей | без scroll spy |
| `RelatedContent` | Связанные ссылки | typed items |
| `Progress` | Прогресс | `role="progressbar"` |
| `LearningPathCard` | Карточка маршрута | limited Guided Learning |
| `ChecklistItem` | Контролируемый чек-элемент | без persistence |

## Отложено

- **Tabs** — полноценный tabs pattern при необходимости headless (base-ui) в отдельном ADR
- **Icon library** — inline glyphs; отдельная библиотека не добавлена
- **Motion library** — CSS only

## Showcase

`/dev/design-system` (dev only)
