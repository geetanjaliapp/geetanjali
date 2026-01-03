import { describe, it, expect } from "vitest";
import { render } from "../../test/utils";
import { axe } from "vitest-axe";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ModalFooter,
} from "./Modal";

describe("Modal accessibility", () => {
  it("should have no accessibility violations when open", async () => {
    const { baseElement } = render(
      <Modal open={true} onClose={() => {}} aria-label="Test modal">
        <ModalHeader>
          <ModalTitle>Test Title</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <p>Test content for the modal.</p>
        </ModalContent>
        <ModalFooter>
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </ModalFooter>
      </Modal>
    );

    const results = await axe(baseElement, {
      rules: {
        // Modal renders in portal, region rule can be noisy
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have proper dialog role and aria-modal", async () => {
    const { baseElement } = render(
      <Modal open={true} onClose={() => {}} aria-label="Accessible modal">
        <ModalContent>
          <p>Content</p>
        </ModalContent>
      </Modal>
    );

    const dialog = baseElement.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Accessible modal");
  });

  it("should have no violations with close button", async () => {
    const { baseElement } = render(
      <Modal open={true} onClose={() => {}} aria-label="Modal with close button">
        <ModalHeader showCloseButton onClose={() => {}}>
          <ModalTitle>Modal with Close</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <p>Content with close button.</p>
        </ModalContent>
      </Modal>
    );

    const results = await axe(baseElement, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
