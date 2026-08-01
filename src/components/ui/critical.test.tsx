/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/forms";
import { Checkbox } from "@/components/ui/selection";
import { Alert } from "@/components/ui/display";
import { PromptBlock } from "@/components/content/content-components";
import { Breadcrumbs } from "@/components/layout/navigation";
import { Progress } from "@/components/content/learning";

describe("Button", () => {
  it("exposes accessible name and handles click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Сохранить</Button>);
    const btn = screen.getByRole("button", { name: "Сохранить" });
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports disabled and loading", () => {
    const { rerender } = render(<Button disabled>X</Button>);
    expect(screen.getByRole("button", { name: "X" })).toBeDisabled();
    rerender(<Button loading>X</Button>);
    expect(screen.getByRole("button", { name: "X" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("Input", () => {
  it("wires label and error", () => {
    render(<Input label="Заголовок" error="Обязательное поле" />);
    expect(screen.getByLabelText(/Заголовок/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Обязательное поле");
  });
});

describe("Checkbox", () => {
  it("toggles via keyboard-capable control", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox label="Принять" checked={false} onChange={onChange} />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Принять" }));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Alert", () => {
  it("exposes status role and title", () => {
    render(<Alert title="Внимание">Текст</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Внимание");
  });
});

describe("PromptBlock", () => {
  it("calls onCopy callback", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(
      <PromptBlock title="Промт" promptText="Hello" onCopy={onCopy} />,
    );
    await user.click(screen.getByRole("button", { name: "Копировать" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});

describe("Breadcrumbs", () => {
  it("marks current page", () => {
    render(
      <Breadcrumbs
        items={[
          { id: "1", label: "Главная", href: "/" },
          { id: "2", label: "Текущая" },
        ]}
      />,
    );
    expect(screen.getByText("Текущая")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("navigation", { name: "Хлебные крошки" })).toBeTruthy();
  });
});

describe("Progress", () => {
  it("exposes progressbar semantics", () => {
    render(<Progress value={3} max={5} label="Шаги 3 из 5" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
  });
});
