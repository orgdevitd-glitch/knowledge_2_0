export type DesignDirectionId = "editorial" | "workspace" | "learning";

export type PrototypeScenario =
  | "home"
  | "article"
  | "prompts"
  | "video"
  | "admin";

export const DESIGN_DIRECTIONS: {
  id: DesignDirectionId;
  name: string;
  axis: string;
  summary: string;
  strengths: string[];
  limits: string[];
  bestFor: string;
}[] = [
  {
    id: "editorial",
    name: "Editorial Knowledge",
    axis: "чтение / типографика / воздух",
    summary:
      "Редакционный портал: сильная иерархия текста, широкие поля, минимум рамок.",
    strengths: [
      "Отлично читаются длинные инструкции",
      "Спокойный деловой тон",
      "Карточки не шумят",
    ],
    limits: [
      "Меньше плотности для больших каталогов",
      "Боковая навигация слабее, чем у workspace",
    ],
    bestFor: "База знаний с упором на статьи и качество чтения",
  },
  {
    id: "workspace",
    name: "Structured Workspace",
    axis: "плотность / модульность / скорость сканирования",
    summary:
      "Рабочая среда: компактные модули, явная навигация, быстрый поиск по многим материалам.",
    strengths: [
      "Удобно держать каталог и инструменты рядом",
      "Хорошая сканируемость списков",
      "Подходит редакторам и power-users",
    ],
    limits: [
      "Меньше «воздуха» для длинного чтения",
      "Риск ощущения «админской» плотности, если не сдерживать",
    ],
    bestFor: "Портал с большим объёмом материалов и частым поиском",
  },
  {
    id: "learning",
    name: "Guided Learning",
    axis: "маршруты / прогресс / практические действия",
    summary:
      "Обучающий контур: заметный прогресс, пошаговые блоки, выразительный жёлтый акцент.",
    strengths: [
      "Понятные учебные маршруты",
      "Хорошо стыкует видео, шаги и практику",
      "Мотивирует пройти сценарий до конца",
    ],
    limits: [
      "Менее универсален для «справочного» режима",
      "Жёлтый акцент нужно дозировать, чтобы не уйти в игривость",
    ],
    bestFor: "Онбординг, курсы и сценарии «сделай по шагам»",
  },
];

export const SCENARIO_LABELS: Record<PrototypeScenario, string> = {
  home: "Главная",
  article: "Статья",
  prompts: "Промты",
  video: "Видео",
  admin: "Админ-фрагмент",
};
