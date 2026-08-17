/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantAnswer } from "@/features/assistant/ui/assistant-answer";
import { AssistantEntryLink } from "@/features/assistant/ui/assistant-entry-link";
import { AssistantExperience } from "@/features/assistant/ui/assistant-experience";
import { AssistantUnavailable } from "@/features/assistant/ui/assistant-unavailable";

const answeredBody = {
  status: "answered",
  blocks: [
    { text: "Первый абзац ответа.", citationNumbers: [1] },
    { text: "Второй абзац с тем же источником.", citationNumbers: [1] },
  ],
  citations: [
    {
      number: 1,
      title: "Политика отпусков",
      href: "/articles/otpusk",
      entityType: "article",
      excerpt: "Сотрудник оформляет заявление.",
    },
  ],
};

function renderExperience(
  overrides?: Partial<ComponentProps<typeof AssistantExperience>>,
) {
  return render(
    <AssistantExperience
      demonstration
      questionMinLength={3}
      questionMaxLength={500}
      categories={[{ id: "c1", title: "Кадры" }]}
      tags={[{ id: "t1", title: "HR" }]}
      audiences={[{ id: "a1", title: "Все" }]}
      {...overrides}
    />,
  );
}

function stubAbortableFetch() {
  const resolvers: Array<(value: Response) => void> = [];
  const fetchMock = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        resolvers.push(resolve);
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, resolvers };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("assistant unavailable and entry", () => {
  it("disabled surface has no form or retry", () => {
    render(<AssistantUnavailable />);
    expect(screen.getByRole("heading", { name: "Ассистент" })).toBeInTheDocument();
    expect(screen.getByText(/пока недоступен/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть поиск" })).toHaveAttribute(
      "href",
      "/search",
    );
  });

  it("entry link does not carry a question", () => {
    render(<AssistantEntryLink />);
    expect(screen.getByRole("link", { name: "Спросить ассистента" })).toHaveAttribute(
      "href",
      "/assistant",
    );
  });
});

describe("assistant form", () => {
  it("exposes label textarea default type and counter", () => {
    renderExperience();
    expect(screen.getByRole("textbox", { name: /Вопрос/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Вопрос/ })).toHaveAttribute("maxLength", "500");
    expect(screen.getByLabelText("Статьи")).toBeChecked();
    expect(screen.getByText("0 / 500")).toBeInTheDocument();
    expect(screen.queryByLabelText(/model|provider|temperature/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GPT|OpenAI|Claude|Gemini/)).not.toBeInTheDocument();
    expect(screen.getByText(/Проверочный режим/)).toBeInTheDocument();
  });

  it("shows prompt warning only for prompt and all", async () => {
    const user = userEvent.setup();
    renderExperience();
    expect(
      screen.queryByText(/не запускаются и не исполняются автоматически/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Промты"));
    expect(
      screen.getByText(/не запускаются и не исполняются автоматически/),
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText("Все материалы"));
    expect(
      screen.getByText(/не запускаются и не исполняются автоматически/),
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText("Статьи"));
    expect(
      screen.queryByText(/не запускаются и не исполняются автоматически/),
    ).not.toBeInTheDocument();
  });

  it("blocks double submit while pending", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    expect(screen.getByRole("button", { name: "Готовим ответ…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Готовим ответ…" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch!(Response.json(answeredBody, { status: 200 }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ответ" })).toBeInTheDocument();
    });
  });
});

describe("assistant request lifecycle", () => {
  it("renders answered citations and ignores stale response", async () => {
    const user = userEvent.setup();
    const resolvers: Array<(value: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Первый вопрос отпуск");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await user.click(screen.getByRole("button", { name: "Отменить ожидание" }));
    await user.clear(screen.getByRole("textbox", { name: /Вопрос/ }));
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Второй вопрос отпуск");
    await user.click(screen.getByRole("button", { name: "Спросить" }));

    resolvers[1]!(Response.json(answeredBody, { status: 200 }));
    await waitFor(() => {
      expect(screen.getByText("Первый абзац ответа.")).toBeInTheDocument();
    });
    resolvers[0]!(
      Response.json(
        {
          status: "answered",
          blocks: [{ text: "STALE_ANSWER", citationNumbers: [1] }],
          citations: answeredBody.citations,
        },
        { status: 200 },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByText("STALE_ANSWER")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Открыть материал" })).toHaveAttribute(
      "href",
      "/articles/otpusk",
    );
    expect(screen.getByText("Статья")).toBeInTheDocument();
  });

  it("cancel does not show an error and keeps the question", async () => {
    const user = userEvent.setup();
    stubAbortableFetch();
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await user.click(screen.getByRole("button", { name: "Отменить ожидание" }));
    expect(screen.getByRole("textbox", { name: /Вопрос/ })).toHaveValue("Как оформить отпуск?");
    expect(screen.queryByText(/временно недоступен/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ответ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Вопрос/ })).toHaveFocus();
  });

  it("maps insufficient rate-limit and unavailable states", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            status: "insufficient_evidence",
            message: "В опубликованных материалах недостаточно информации для ответа.",
            searchHref: "/search?q=ops",
          },
          { status: 200 },
        ),
      ),
    );
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByText(/недостаточно информации/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Открыть обычный поиск" })).toHaveAttribute(
      "href",
      "/search?q=ops",
    );
    expect(screen.getByText(/адресную строку поиска/)).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { status: "rate_limited", message: "Слишком много запросов. Подождите немного и попробуйте снова." },
          { status: 429 },
        ),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    });

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("offline");
    }));
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Открыть поиск" })).toHaveAttribute(
        "href",
        "/search",
      );
    });
  });

  it("new question clears answer and keeps filters", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 200 })),
    );
    renderExperience();
    await user.click(screen.getByLabelText("Промты"));
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ответ" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Новый вопрос" }));
    expect(screen.getByRole("textbox", { name: /Вопрос/ })).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "Ответ" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Промты")).toBeChecked();
  });

  it("does not persist question in URL or web storage", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 200 })),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ответ" })).toBeInTheDocument();
    });
    expect(window.location.href).not.toMatch(/Как оформить|otpusk|question=/);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(JSON.stringify(log.mock.calls)).not.toContain("Как оформить отпуск?");
  });
});

describe("assistant answer rendering", () => {
  it("renders HTML-looking text without HTML markdown or autolink", () => {
    const { container } = render(
      <AssistantAnswer
        data={{
          status: "answered",
          blocks: [
            {
              text: '<script>alert(1)</script> и [текст](https://evil.example) и https://evil.example и [1]',
              citationNumbers: [1],
            },
          ],
          citations: [
            {
              number: 1,
              title: "Гайд",
              href: "/articles/gajd",
              entityType: "article",
            },
          ],
        }}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toMatch(/dangerouslySetInnerHTML/);
    expect(container.querySelector("a[href='https://evil.example']")).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Источник 1: Гайд" })).toBeInTheDocument();
  });

  it("renders prompt badge", () => {
    render(
      <AssistantAnswer
        data={{
          status: "answered",
          blocks: [{ text: "Справочный текст.", citationNumbers: [1] }],
          citations: [
            {
              number: 1,
              title: "Промт оформления",
              href: "/prompts/oformlenie",
              entityType: "prompt",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Промт")).toBeInTheDocument();
  });

  it("focuses source card from citation chip without hash pollution", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <AssistantAnswer
        data={{
          status: "answered",
          blocks: [{ text: "Текст ответа.", citationNumbers: [1] }],
          citations: [
            {
              number: 1,
              title: "Гайд",
              href: "/articles/gajd",
              entityType: "article",
              excerpt: "Фрагмент источника.",
            },
          ],
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Источник 1: Гайд" }));
    expect(document.getElementById("assistant-source-1")).toHaveFocus();
    expect(scroll).toHaveBeenCalled();
    expect(window.location.hash).not.toMatch(/assistant-source/);
  });
});

describe("assistant hardening states", () => {
  it("hides demonstration badge when not in demonstration", () => {
    renderExperience({ demonstration: false });
    expect(screen.queryByText(/Проверочный режим/)).not.toBeInTheDocument();
    expect(screen.queryByText(/тестовым адаптером/)).not.toBeInTheDocument();
  });

  it("does not put the question in the URL across interactions", async () => {
    const user = userEvent.setup();
    const hrefs: string[] = [];
    const record = () => hrefs.push(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 200 })),
    );
    renderExperience();
    const box = screen.getByRole("textbox", { name: /Вопрос/ });
    await user.type(box, "Как оформить отпуск?");
    record();
    await user.click(screen.getByLabelText("Промты"));
    record();
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ответ" })).toBeInTheDocument();
    });
    record();
    await user.click(screen.getByRole("button", { name: "Новый вопрос" }));
    record();
    expect(hrefs.every((h) => !h.includes("Как") && !h.includes("question"))).toBe(true);
  });

  it("does not write assistant state to web storage or cookies", async () => {
    const user = userEvent.setup();
    const setLocal = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 200 })),
    );
    const cookieBefore = document.cookie;
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ответ" })).toBeInTheDocument();
    });
    expect(setLocal).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe(cookieBefore);
    expect(document.cookie).not.toContain("Как оформить");
  });

  it("hides previous answer when a later request fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 200 })),
    );
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByText("Первый абзац ответа.")).toBeInTheDocument();
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("offline");
    }));
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Первый абзац ответа.")).not.toBeInTheDocument();
  });

  it("ignores a cancelled request that resolves after a newer submit", async () => {
    const user = userEvent.setup();
    const { resolvers } = stubAbortableFetch();
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Первый вопрос отпуск");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await user.click(screen.getByRole("button", { name: "Отменить ожидание" }));
    await user.clear(screen.getByRole("textbox", { name: /Вопрос/ }));
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Второй вопрос отпуск");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    resolvers[1]!(Response.json(answeredBody, { status: 200 }));
    await waitFor(() => {
      expect(screen.getByText("Первый абзац ответа.")).toBeInTheDocument();
    });
    resolvers[0]!(
      Response.json(
        {
          status: "answered",
          blocks: [{ text: "CANCELLED_LATE", citationNumbers: [1] }],
          citations: answeredBody.citations,
        },
        { status: 200 },
      ),
    );
    await waitFor(() => {
      expect(screen.queryByText("CANCELLED_LATE")).not.toBeInTheDocument();
    });
  });

  it("does not update state after unmount", async () => {
    const user = userEvent.setup();
    const { resolvers } = stubAbortableFetch();
    const { unmount } = renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    unmount();
    await Promise.resolve();
    expect(errors.join("\n")).not.toMatch(/unmounted component|state update/i);
    expect(resolvers.length).toBe(1);
  });

  it("retry is explicit and uses the current question", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(
        { status: "rate_limited", message: "Слишком много запросов. Подождите немного и попробуйте снова." },
        { status: 429 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(secondInit?.body));
    expect(body.question).toBe("Как оформить отпуск?");
  });

  it("shows search fallback privacy notice only when q is present", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            status: "insufficient_evidence",
            message: "В опубликованных материалах недостаточно информации для ответа.",
            searchHref: "/search",
          },
          { status: 200 },
        ),
      ),
    );
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Открыть обычный поиск" })).toHaveAttribute(
        "href",
        "/search",
      );
    });
    expect(screen.queryByText(/адресную строку поиска/)).not.toBeInTheDocument();
  });

  it("keeps insufficient state without a link when searchHref is unsafe", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            status: "insufficient_evidence",
            message: "В опубликованных материалах недостаточно информации для ответа.",
            searchHref: "/search/../admin",
          },
          { status: 200 },
        ),
      ),
    );
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByText(/недостаточно информации/)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "Открыть обычный поиск" })).not.toBeInTheDocument();
    expect(screen.queryByText(/адресную строку поиска/)).not.toBeInTheDocument();
  });

  it("blocks empty and whitespace-only questions without fetching", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "   ");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the character counter aligned with the textarea", async () => {
    const user = userEvent.setup();
    renderExperience();
    const box = screen.getByRole("textbox", { name: /Вопрос/ });
    await user.type(box, "Привет");
    expect(screen.getByText("6 / 500")).toBeInTheDocument();
  });

  it("renders taxonomy labels as text and resets filters to article", async () => {
    const user = userEvent.setup();
    renderExperience({
      categories: [{ id: "c1", title: "<img src=x onerror=alert(1)>Категория" }],
    });
    await user.click(screen.getByText("Уточнить поиск"));
    expect(screen.getByRole("option", { name: /Категория/ }).textContent).toContain(
      "<img src=x onerror=alert(1)>Категория",
    );
    expect(document.querySelector("img")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Категория"), "c1");
    await user.click(screen.getByLabelText("Промты"));
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getByLabelText("Статьи")).toBeChecked();
    expect(screen.getByLabelText("Категория")).toHaveValue("");
  });

  it("does not submit from Enter inside the multiline textarea", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderExperience();
    const box = screen.getByRole("textbox", { name: /Вопрос/ });
    await user.click(box);
    await user.keyboard("Как{Enter}оформить");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(box).toHaveValue("Как\nоформить");
  });

  it("exposes a short polite live region without the full answer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(answeredBody, { status: 200 })),
    );
    renderExperience();
    await user.type(screen.getByRole("textbox", { name: /Вопрос/ }), "Как оформить отпуск?");
    await user.click(screen.getByRole("button", { name: "Спросить" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ответ" })).toBeInTheDocument();
    });
    const live = document.querySelector("[aria-live='polite']");
    expect(live?.textContent).toBe("Ответ готов");
    expect(live?.textContent).not.toContain("Первый абзац ответа.");
  });
});

