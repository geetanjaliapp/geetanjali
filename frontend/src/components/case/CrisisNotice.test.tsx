import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CrisisNotice } from "./CrisisNotice";
import crisisNotice from "../../content/crisis-notice.json";

describe("CrisisNotice", () => {
  it("keeps the owner-approved wording", () => {
    // Literal copy on purpose: a wording change must be a deliberate test change.
    expect(crisisNotice.text).toBe(
      "If you're carrying something heavier than a decision, please talk to someone you trust or call a local helpline.",
    );
  });

  it("renders the sentence under the given id with no link", () => {
    render(<CrisisNotice id="crisis-notice" />);
    const notice = screen.getByText(crisisNotice.text);
    expect(notice).toHaveAttribute("id", "crisis-notice");
    expect(within(notice).queryByRole("link")).toBeNull();
  });
});
