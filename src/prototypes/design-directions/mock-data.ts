/**
 * MOCK DATA — Phase 2A design-direction prototypes only.
 * Not production content. Do not import into public/admin routes or Firestore.
 */
export const MOCK_MARKER = "mock-design-direction-v1" as const;

export type MockAudience = "all" | "managers" | "specialists" | "editors";
export type MockMaterialType = "article" | "prompt" | "video" | "checklist";
export type MockFreshness = "current" | "review-soon" | "outdated";

export type MockMaterial = {
  id: string;
  title: string;
  summary: string;
  category: string;
  type: MockMaterialType;
  updatedAtLabel: string;
  freshness: MockFreshness;
  audience: MockAudience;
};

export type MockPrompt = {
  id: string;
  title: string;
  summary: string;
  category: string;
  audience: MockAudience;
  promptText: string;
  relatedGuides: string[];
};

export type MockVideo = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
  chapters: { time: string; label: string }[];
  transcript: string[];
  related: string[];
};

export type MockNavItem = {
  id: string;
  label: string;
  href: string;
};

export const mockNav: MockNavItem[] = [
  { id: "home", label: "Главная", href: "#home" },
  { id: "catalog", label: "Каталог", href: "#catalog" },
  { id: "prompts", label: "Промты", href: "#prompts" },
  { id: "learning", label: "Обучение", href: "#learning" },
  { id: "video", label: "Видео", href: "#video" },
];

export const mockMaterials: MockMaterial[] = [
  {
    id: "m-1",
    title: "Как подготовить бриф для ChatGPT",
    summary:
      "Короткий алгоритм: цель, контекст, ограничения, формат ответа и критерии качества.",
    category: "Цифровые инструменты",
    type: "article",
    updatedAtLabel: "12 мар 2026",
    freshness: "current",
    audience: "all",
  },
  {
    id: "m-2",
    title: "Чек-лист проверки ответа модели",
    summary:
      "Проверка фактов, тона, полноты и рисков перед отправкой результата коллегам.",
    category: "Качество",
    type: "checklist",
    updatedAtLabel: "3 мар 2026",
    freshness: "review-soon",
    audience: "specialists",
  },
  {
    id: "m-3",
    title: "Сценарий: подготовка еженедельного отчёта",
    summary:
      "Пошаговый маршрут от сырых заметок до согласованного управленческого текста.",
    category: "Рабочие сценарии",
    type: "article",
    updatedAtLabel: "28 фев 2026",
    freshness: "current",
    audience: "managers",
  },
  {
    id: "m-4",
    title: "Видео: безопасная работа с данными",
    summary:
      "Что можно и нельзя передавать в диалог с моделью в корпоративном контуре.",
    category: "Безопасность",
    type: "video",
    updatedAtLabel: "20 фев 2026",
    freshness: "current",
    audience: "all",
  },
];

export const mockPrompts: MockPrompt[] = [
  {
    id: "p-1",
    title: "Структура ответа для клиента",
    summary: "Превращает черновик в вежливый и полный ответ с ясным next step.",
    category: "Коммуникации",
    audience: "specialists",
    promptText: [
      "Ты — корпоративный ассистент по клиентским коммуникациям.",
      "На входе: черновик ответа и факты, которые нельзя искажать.",
      "Сформируй ответ на русском языке:",
      "1) краткое подтверждение запроса;",
      "2) суть решения;",
      "3) ограничения или риски;",
      "4) следующий шаг и срок.",
      "Не выдумывай цифры. Если данных не хватает — перечисли вопросы.",
      "Тон: деловой, спокойный, без канцелярита.",
    ].join("\n"),
    relatedGuides: ["Как подготовить бриф для ChatGPT", "Чек-лист проверки ответа модели"],
  },
  {
    id: "p-2",
    title: "Сжатие длинной инструкции",
    summary: "Сокращает регламент до рабочих шагов без потери обязательных правил.",
    category: "Обучение",
    audience: "editors",
    promptText: [
      "Сократи корпоративную инструкцию до практического чек-листа.",
      "Сохрани обязательные правила и запреты.",
      "Формат: заголовок, 5–9 шагов, блок «Частые ошибки».",
      "Не добавляй новые требования.",
    ].join("\n"),
    relatedGuides: ["Сценарий: подготовка еженедельного отчёта"],
  },
  {
    id: "p-3",
    title: "План обучения новичка",
    summary: "Собирает маршрут из каталога материалов под роль сотрудника.",
    category: "Онбординг",
    audience: "managers",
    promptText: [
      "Составь двухнедельный план обучения новичка.",
      "Роль: специалист поддержки.",
      "Используй только перечисленные материалы портала.",
      "Для каждого дня укажи цель, материал и критерий «сделано».",
    ].join("\n"),
    relatedGuides: ["Видео: безопасная работа с данными"],
  },
];

export const mockVideo: MockVideo = {
  id: "v-1",
  title: "Безопасная работа с данными в диалоге с ИИ",
  description:
    "Базовый разбор: персональные данные, коммерческая тайна, примеры безопасных формулировок и что делать при сомнении.",
  durationLabel: "12:40",
  chapters: [
    { time: "00:00", label: "Зачем нужны правила" },
    { time: "02:15", label: "Что нельзя передавать" },
    { time: "06:10", label: "Безопасные формулировки" },
    { time: "09:45", label: "Куда эскалировать вопрос" },
  ],
  transcript: [
    "В этом ролике мы разбираем, какие данные допустимо использовать в рабочих диалогах с моделью.",
    "Правило простое: не передавайте то, что нельзя показать внешнему подрядчику без договора.",
    "Если сомневаетесь — обезличьте пример или обратитесь к ответственному за информационную безопасность.",
  ],
  related: ["Чек-лист проверки ответа модели", "Как подготовить бриф для ChatGPT"],
};

export const mockArticle = {
  title: "Как подготовить бриф для ChatGPT",
  category: "Цифровые инструменты",
  updatedAtLabel: "12 мар 2026",
  audienceLabel: "Для всех сотрудников",
  toc: [
    "Зачем нужен бриф",
    "Обязательные поля",
    "Пример хорошего брифа",
    "Частые ошибки",
  ],
  paragraphs: [
    "Хороший бриф экономит время: модель получает контекст сразу, а вы получаете ответ ближе к нужному формату с первой попытки.",
    "Ниже — минимальный набор полей, который стоит заполнять перед сложным запросом. Для коротких задач достаточно цели и формата.",
  ],
  steps: [
    "Сформулируйте цель одним предложением.",
    "Добавьте контекст: аудитория, канал, ограничения.",
    "Опишите желаемый формат ответа.",
    "Укажите, чего делать нельзя.",
    "Проверьте результат по чек-листу качества.",
  ],
  info: "Не вставляйте в бриф персональные данные клиентов и внутренние пароли. Используйте обобщённые примеры.",
  promptPreview: mockPrompts[0]?.promptText ?? "",
  related: ["Чек-лист проверки ответа модели", "Структура ответа для клиента"],
};

export const mockRoles = [
  { id: "all", title: "Всем сотрудникам", hint: "Базовые правила и быстрые сценарии" },
  { id: "managers", title: "Руководителям", hint: "Отчёты, делегирование, контроль качества" },
  { id: "specialists", title: "Специалистам", hint: "Рабочие промты и проверка ответов" },
  { id: "editors", title: "Редакторам базы", hint: "Структура материалов и обновления" },
];

export const mockAdminBlocks = [
  { id: "b1", type: "heading", label: "Заголовок", selected: false },
  { id: "b2", type: "paragraph", label: "Абзац", selected: true },
  { id: "b3", type: "steps", label: "Шаги", selected: false },
  { id: "b4", type: "prompt", label: "Промт", selected: false },
  { id: "b5", type: "info", label: "Инфо-блок", selected: false },
];

export const freshnessLabel: Record<MockFreshness, string> = {
  current: "Актуально",
  "review-soon": "Скоро на проверке",
  outdated: "Устарело",
};

export const typeLabel: Record<MockMaterialType, string> = {
  article: "Статья",
  prompt: "Промт",
  video: "Видео",
  checklist: "Чек-лист",
};

export const audienceLabel: Record<MockAudience, string> = {
  all: "Всем",
  managers: "Руководителям",
  specialists: "Специалистам",
  editors: "Редакторам",
};
