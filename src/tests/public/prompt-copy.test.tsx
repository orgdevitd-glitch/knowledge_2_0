/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { PromptCopyButton } from "@/features/public-content/rendering/prompt-copy-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PromptCopyButton", () => {
  it("copies text and shows temporary state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PromptCopyButton text="hello prompt" />);
    fireEvent.click(
      screen.getByRole("button", { name: /копировать текст промта/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /копировать текст промта/i }),
      ).toHaveTextContent("Скопировано");
    });
    expect(writeText).toHaveBeenCalledWith("hello prompt");
  });

  it("handles missing clipboard safely", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    render(<PromptCopyButton text="x" />);
    fireEvent.click(
      screen.getByRole("button", { name: /копировать текст промта/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/не удалось скопировать/i),
      ).toBeTruthy();
    });
  });
});
