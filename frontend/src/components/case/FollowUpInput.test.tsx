import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { FollowUpInput } from "./FollowUpInput";
import crisisNotice from "../../content/crisis-notice.json";

function renderInput(
  props: { error?: string | null; disabled?: boolean } = {},
) {
  return render(
    <MemoryRouter>
      <FollowUpInput
        value=""
        submitting={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

function describedByIdsResolve(el: HTMLElement) {
  const ids = (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
}

describe("FollowUpInput crisis notice", () => {
  it("describes the input with the notice", async () => {
    const { container } = renderInput();
    const input = screen.getByLabelText("Ask a follow-up question");
    expect(input).toHaveAccessibleDescription(crisisNotice.text);
    describedByIdsResolve(input);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("describes the input with both the error and the notice", async () => {
    const { container } = renderInput({ error: "Something went wrong" });
    const input = screen.getByLabelText("Ask a follow-up question");
    expect(input).toHaveAccessibleDescription(
      `Something went wrong ${crisisNotice.text}`,
    );
    describedByIdsResolve(input);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps the notice outside the faded wrapper while disabled", async () => {
    const { container } = renderInput({ disabled: true });
    const input = screen.getByLabelText("Ask a follow-up question");
    const card = input.closest("form")!.parentElement!;
    expect(card).toHaveClass("opacity-60");
    expect(card.contains(screen.getByText(crisisNotice.text))).toBe(false);
    expect(await axe(container)).toHaveNoViolations();
  });
});
