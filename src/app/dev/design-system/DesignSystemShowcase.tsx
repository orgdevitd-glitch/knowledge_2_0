"use client";

import { useState } from "react";

import {
  AppHeader,
  Breadcrumbs,
  Container,
  Divider,
  Grid,
  Inline,
  MobileNavigationPanel,
  Sidebar,
  Stack,
  Surface,
  VisuallyHidden,
} from "@/components/layout";
import {
  ArticleHeader,
  Callout,
  ChecklistItem,
  LearningPathCard,
  Progress,
  PromptBlock,
  Prose,
  RelatedContent,
  StepList,
  TableOfContents,
} from "@/components/content";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  Link,
  MetadataList,
  NativeSelect,
  RadioGroup,
  SearchField,
  Skeleton,
  Status,
  Switch,
  Textarea,
} from "@/components/ui";

import showcase from "./showcase.module.css";

const MOCK = "mock-design-system-v1";

export function DesignSystemShowcase() {
  const [copied, setCopied] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [radio, setRadio] = useState("a");
  const [search, setSearch] = useState("");
  const [checklist, setChecklist] = useState(false);

  return (
    <div className={showcase.root} data-mock={MOCK}>
      <Container width="wide">
        <Stack gap={6}>
          <header className={showcase.hero}>
            <p className={showcase.eyebrow}>Phase 2B · Production design system</p>
            <h1>Design System Showcase</h1>
            <p className={showcase.lede}>
              Гибрид: Workspace (оболочка/каталоги/админка) · Editorial (длинный
              текст) · Guided Learning (ограниченно). Mock: {MOCK}
            </p>
          </header>

          <section className={showcase.section} aria-labelledby="tokens">
            <h2 id="tokens">Токены</h2>
            <h3>Палитра</h3>
            <Grid minItemWidth="8rem" gap={2}>
              {[
                ["background", "#FFFFFF"],
                ["foreground", "#010101"],
                ["accent", "#F8BC03"],
                ["secondary", "#1F4E79"],
                ["surface-muted", "#F6F6F4"],
                ["border", "#E7E7E3"],
                ["text-muted", "#6B6B67"],
                ["surface-dark", "#2A2A28"],
              ].map(([name, value]) => (
                <Surface key={name} className={showcase.swatch}>
                  <div
                    className={showcase.swatchColor}
                    style={{ background: value, color: name === "accent" || name === "background" || name === "surface-muted" || name === "border" ? "#010101" : "#fff" }}
                  />
                  <strong>{name}</strong>
                  <span>{value}</span>
                </Surface>
              ))}
            </Grid>
            <h3>Семантика</h3>
            <Inline gap={2} wrap>
              <Badge tone="success">success</Badge>
              <Badge tone="warning">warning</Badge>
              <Badge tone="error">error</Badge>
              <Badge tone="information">info</Badge>
            </Inline>
            <h3>Типографика</h3>
            <Stack gap={2}>
              <p style={{ fontSize: "var(--text-display-size)", fontWeight: 650 }}>
                Display · IBM Plex Sans
              </p>
              <p style={{ fontSize: "var(--text-h1-size)", fontWeight: 650 }}>
                Heading 1
              </p>
              <p style={{ fontSize: "var(--text-body-size)" }}>
                Body · интерфейсный текст 15px
              </p>
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "var(--prose-body-size)",
                  lineHeight: "var(--prose-body-line)",
                }}
              >
                Editorial body · Source Serif 4 для длинных инструкций.
              </p>
              <code style={{ fontFamily: "var(--font-mono)" }}>code · monospace</code>
            </Stack>
          </section>

          <Divider />

          <section className={showcase.section} aria-labelledby="buttons">
            <h2 id="buttons">Button / Link</h2>
            <Inline gap={2} wrap>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <IconButton label="Настройки">⚙</IconButton>
            </Inline>
            <Inline gap={3} wrap>
              <Link href="#buttons" variant="inline">
                inline link
              </Link>
              <Link href="#buttons" variant="navigation" active>
                navigation
              </Link>
              <Link href="#buttons" variant="standalone">
                standalone
              </Link>
              <Link href="#buttons" variant="subtle">
                subtle
              </Link>
            </Inline>
          </section>

          <section className={showcase.section} aria-labelledby="forms">
            <h2 id="forms">Forms</h2>
            <Grid minItemWidth="16rem" gap={4}>
              <Input label="Название" description="Обязательное поле" required />
              <Input label="Ошибка" error="Укажите значение" defaultValue="" />
              <Textarea label="Описание" defaultValue="Короткий текст" />
              <SearchField
                label="Поиск"
                hideLabel
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
                placeholder="Материалы…"
              />
              <NativeSelect
                label="Категория"
                options={[
                  { value: "a", label: "Инструкции" },
                  { value: "b", label: "Промты" },
                ]}
              />
              <Checkbox
                label="Согласен с правилами"
                description="Можно снять позже"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <RadioGroup
                name="demo-radio"
                legend="Формат"
                value={radio}
                onChange={setRadio}
                options={[
                  { value: "a", label: "Статья" },
                  { value: "b", label: "Видео" },
                ]}
              />
              <Switch
                label="Мгновенные уведомления"
                description="Только для настройки, не для подтверждения формы"
                checked={switchOn}
                onCheckedChange={setSwitchOn}
              />
            </Grid>
          </section>

          <section className={showcase.section} aria-labelledby="display">
            <h2 id="display">Display</h2>
            <Inline gap={2} wrap>
              <Status tone="success" label="Актуально" />
              <Status tone="warning" label="Скоро на проверке" />
              <Status tone="error" label="Устарело" />
            </Inline>
            <Alert tone="information" title="Информация" className="ds-fade-in">
              Статус всегда сопровождается текстом, не только цветом.
            </Alert>
            <Alert tone="warning" title="Внимание">
              Не передавайте персональные данные в промт.
            </Alert>
            <Grid minItemWidth="14rem">
              <Card>
                <strong>Карточка</strong>
                <MetadataList
                  items={[
                    { label: "Тип", value: "Статья" },
                    { label: "Обновлено", value: "12 мар 2026" },
                  ]}
                />
              </Card>
              <Card interactive selected>
                <strong>Selected interactive</strong>
              </Card>
              <Card disabled>
                <strong>Disabled</strong>
              </Card>
            </Grid>
            <EmptyState
              title="Ничего не найдено"
              description="Измените запрос или сбросьте фильтры."
              primaryAction={<Button>Сбросить</Button>}
              secondaryAction={<Button variant="secondary">В каталог</Button>}
            />
            <Skeleton width="100%" height="2.5rem" />
          </section>

          <section className={showcase.section} aria-labelledby="content">
            <h2 id="content">Content / Editorial</h2>
            <ArticleHeader
              title="Как подготовить бриф для ChatGPT"
              summary="Короткий алгоритм: цель, контекст, ограничения и формат ответа."
              statusLabel="Актуально"
              metadata={[
                { label: "Категория", value: "Цифровые инструменты" },
                { label: "Аудитория", value: "Всем" },
              ]}
            />
            <TableOfContents
              items={[
                { id: "1", label: "Зачем нужен бриф", href: "#content" },
                { id: "2", label: "Шаги", href: "#content" },
              ]}
            />
            <Prose>
              <p>
                Хороший бриф экономит время: модель получает контекст сразу, а вы
                получаете ответ ближе к нужному формату с первой попытки.
              </p>
              <blockquote>Не вставляйте пароли и персональные данные клиентов.</blockquote>
              <p>
                Пример кода: <code>promptText</code>
              </p>
            </Prose>
            <Callout variant="important" title="Важно">
              Жёлтый акцент используется точечно, не как фон всей страницы.
            </Callout>
            <StepList
              steps={[
                {
                  id: "s1",
                  title: "Сформулируйте цель",
                  description: "Одним предложением.",
                  completed: true,
                },
                {
                  id: "s2",
                  title: "Добавьте ограничения",
                  description: "Что нельзя делать модели.",
                },
              ]}
            />
            <PromptBlock
              title="Структура ответа для клиента"
              description="Демонстрационный промт"
              promptText={[
                "Ты — корпоративный ассистент.",
                "Сформируй ответ:",
                "1) подтверждение;",
                "2) суть;",
                "3) следующий шаг.",
                "Не выдумывай цифры.",
              ].join("\n")}
              copied={copied}
              onCopy={() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            />
            <RelatedContent
              items={[
                {
                  id: "r1",
                  title: "Чек-лист проверки ответа",
                  href: "#content",
                  type: "Чек-лист",
                },
              ]}
            />
          </section>

          <section className={showcase.section} aria-labelledby="nav">
            <h2 id="nav">Navigation</h2>
            <AppHeader
              brand="Портал знаний"
              search={
                <SearchField
                  label="Поиск по порталу"
                  hideLabel
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              }
              actions={<Button size="small">Войти</Button>}
              onOpenNavigation={() => setNavOpen(true)}
            />
            <Inline gap={4} align="stretch">
              <Sidebar
                groups={[
                  {
                    id: "g1",
                    label: "Разделы",
                    items: [
                      { id: "i1", label: "Главная", href: "#nav", active: true },
                      { id: "i2", label: "Каталог", href: "#nav" },
                      { id: "i3", label: "Промты", href: "#nav" },
                    ],
                  },
                ]}
              />
              <div style={{ flex: 1 }}>
                <Breadcrumbs
                  items={[
                    { id: "b1", label: "Главная", href: "#nav" },
                    { id: "b2", label: "Каталог", href: "#nav" },
                    { id: "b3", label: "Статья" },
                  ]}
                />
              </div>
            </Inline>
            <MobileNavigationPanel
              open={navOpen}
              onClose={() => setNavOpen(false)}
            >
              <Sidebar
                groups={[
                  {
                    id: "m1",
                    label: "Меню",
                    items: [
                      { id: "mi1", label: "Главная", href: "#nav", active: true },
                      { id: "mi2", label: "Обучение", href: "#learning" },
                    ],
                  },
                ]}
              />
            </MobileNavigationPanel>
          </section>

          <section className={showcase.section} aria-labelledby="learning">
            <h2 id="learning">Guided Learning (ограниченно)</h2>
            <Progress value={42} max={100} label="Маршрут «Базовый ИИ» · 42%" />
            <Grid minItemWidth="16rem">
              <LearningPathCard
                title="Безопасная работа с данными"
                description="Короткий маршрут для всех сотрудников"
                stepsCount={5}
                durationLabel="~25 мин"
                progressValue={2}
                progressMax={5}
                progressLabel="2 из 5 шагов"
              />
            </Grid>
            <ChecklistItem
              label="Прочитал правила передачи данных"
              checked={checklist}
              onCheckedChange={setChecklist}
            />
          </section>

          <VisuallyHidden>Конец витрины дизайн-системы</VisuallyHidden>
        </Stack>
      </Container>
    </div>
  );
}
