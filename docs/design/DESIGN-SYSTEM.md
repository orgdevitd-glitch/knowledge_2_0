# Design System — Production (Phase 2B)

## Гибридное направление

Утверждённая модель:

| Область | Режим |
|---------|--------|
| Оболочка, навигация, каталоги, фильтры, промты, видеотека, таблицы, админка | **Structured Workspace** |
| Статьи, инструкции, регламенты, длинный текст, расшифровки | **Editorial Knowledge** |
| Обучающие маршруты, шаги, чек-листы, прогресс, next action | **Guided Learning** (ограниченно) |

Phase 4 public UI follows this hybrid: Workspace shell/catalogs/prompts; Editorial article reading. Phase 8A Prompt Admin uses the same Structured Workspace admin patterns as Article Admin (dense forms, no marketing hero, no new UI libraries). No dark theme.

Прототипы Phase 2A сохранены в `/dev/design-directions` для сравнения.

## Палитра

```text
background: #FFFFFF
foreground: #010101
accent: #F8BC03
secondary: #1F4E79
surface-muted: #F6F6F4
border: #E7E7E3
text-muted: #6B6B67
surface-dark: #2A2A28
```

Правила: белый фон; почти чёрный текст; жёлтый — главный CTA (тёмный текст на жёлтом); синий — ссылки/info/вторичное; без новых брендовых цветов.

## Семантические цвета

| Токен | Значение | Фон |
|-------|----------|-----|
| success | `#1F6B3A` | `#E8F5EC` |
| warning | `#8A5B00` | `#FFF4D6` |
| error | `#A11B1B` | `#FDECEC` |
| info | `#1F4E79` | `#E8EEF4` |

Статус всегда с текстом и/или маркером — не только цветом.

## Типографика

- **Интерфейс:** IBM Plex Sans (`next/font`)
- **Длинный текст:** Source Serif 4 (класс `.ds-prose` / `Prose`)
- **Код:** системный monospace
- Заголовки статей в prose: **IBM Plex Sans** (единое правило)
- Nunito Sans — только в прототипах 2A, не в production

Шкала токенов: `display`, `heading-1…4`, `body-large`, `body`, `body-small`, `label`, `caption`, `code` (+ editorial measure).

## Spacing / radius / shadow / motion

- Spacing: 4, 8, 12, 16, 24, 32, 48, 64
- Radius: compact, control, card, panel, round
- Shadow: panel / dialog / raised — не на каждую карточку
- Duration: instant, fast (120), normal (200), slow (280)
- Easing: `--ease-out`, `--ease-move`, `--ease-standard`
- Без `transition: all`; hover только с `(hover: hover)`; `prefers-reduced-motion`

## Компоненты

См. `docs/design/COMPONENT-CATALOG.md`.

Размещение:

- `src/components/ui`
- `src/components/layout`
- `src/components/content`

Без Firestore / Google API / бизнес-логики / хардкода контента.

## Доступность

- focus-visible
- доступные имена
- клавиатура для форм/кнопок/switch/panel (Escape)
- статус не только цветом
- reduced motion

## Responsive

Workspace-плотность на desktop; перенос длинных текстов; touch min ~44px для icon controls; mobile nav panel.

## Запрещённые паттерны

- жёлтый текст на белом
- тёмная тема
- UI-kit с чужим визуалом
- декоративный motion
- большие жёлтые поверхности «везде»
- Nunito Sans в production
- превращение всего портала в learning UI

## Showcase

Development: `/dev/design-system`  
Production: 404
