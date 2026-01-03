import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/utils";
import { axe } from "vitest-axe";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "./UserMenu";

describe("UserMenu accessibility", () => {
  const defaultProps = {
    user: null,
    isAuthenticated: false,
    onLogout: vi.fn(),
  };

  it("should have no accessibility violations with menu closed", async () => {
    const { container } = render(<UserMenu {...defaultProps} />);

    const results = await axe(container, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have no violations with menu open (guest)", async () => {
    const user = userEvent.setup();
    const { container } = render(<UserMenu {...defaultProps} />);

    // Open the menu
    const trigger = screen.getByRole("button", { name: /account/i });
    await user.click(trigger);

    const results = await axe(container, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have no violations when authenticated", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <UserMenu
        {...defaultProps}
        isAuthenticated={true}
        user={{ id: "1", email: "test@example.com", name: "Test User" }}
      />
    );

    // Open the menu
    const trigger = screen.getByRole("button");
    await user.click(trigger);

    const results = await axe(container, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have proper button attributes", () => {
    render(<UserMenu {...defaultProps} />);

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded");
  });
});
