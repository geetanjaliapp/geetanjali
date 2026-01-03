import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils";
import { axe } from "vitest-axe";
import { MobileDrawer } from "./MobileDrawer";

describe("MobileDrawer accessibility", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    pathname: "/",
    isAuthenticated: false,
    user: null,
    onLogout: vi.fn(),
  };

  it("should have no accessibility violations when open as guest", async () => {
    const { baseElement } = render(<MobileDrawer {...defaultProps} />);

    const results = await axe(baseElement, {
      rules: {
        // Drawer may not be in a landmark region
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have no violations when authenticated", async () => {
    const { baseElement } = render(
      <MobileDrawer
        {...defaultProps}
        isAuthenticated={true}
        user={{ email: "test@example.com", name: "Test User" }}
      />
    );

    const results = await axe(baseElement, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have proper navigation role and label", () => {
    const { baseElement } = render(<MobileDrawer {...defaultProps} />);

    const nav = baseElement.querySelector('[role="navigation"]');
    expect(nav).toHaveAttribute("aria-label", "Mobile navigation");
  });
});
