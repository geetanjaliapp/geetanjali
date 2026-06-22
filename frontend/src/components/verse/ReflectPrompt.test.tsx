import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReflectPrompt from "./ReflectPrompt";

function renderPrompt(overrides = {}) {
  return render(
    <MemoryRouter>
      <ReflectPrompt
        canonicalId="BG_2_47"
        verseParaphrase="You have the right to perform your prescribed duties..."
        verseTranslation="You have a right to perform..."
        {...overrides}
      />
    </MemoryRouter>
  );
}

describe("ReflectPrompt", () => {
  it("renders collapsed by default", () => {
    renderPrompt();
    expect(screen.getByText("Reflect")).toBeInTheDocument();
    // Textarea is in DOM but hidden via max-h-0 overflow-hidden
    // Check the parent container is collapsed (not visible)
    const textarea = screen.getByPlaceholderText("This verse reminds me of...");
    expect(textarea.closest('[class*="max-h-0"]')).toBeInTheDocument();
  });

  it("expands on header click", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    expect(
      screen.getByPlaceholderText("This verse reminds me of...")
    ).toBeInTheDocument();
  });

  it("shows verse paraphrase when expanded", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    expect(
      screen.getByText(/You have the right to perform/)
    ).toBeInTheDocument();
  });

  it("renders without paraphrase when null", () => {
    renderPrompt({ verseParaphrase: null });
    fireEvent.click(screen.getByText("Reflect"));
    // No crash, still renders textarea
    expect(
      screen.getByPlaceholderText("This verse reminds me of...")
    ).toBeInTheDocument();
  });

  it("shows character counter starting at 0/500", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("hides consultation button below 20 chars", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    const textarea = screen.getByPlaceholderText(
      "This verse reminds me of..."
    );
    fireEvent.change(textarea, { target: { value: "Short text" } }); // 10 chars
    expect(
      screen.queryByText("Get guided perspective")
    ).not.toBeInTheDocument();
  });

  it("shows consultation button at 20+ chars", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    const textarea = screen.getByPlaceholderText(
      "This verse reminds me of..."
    );
    fireEvent.change(textarea, {
      target: { value: "This is at least twenty characters long" },
    }); // 42 chars
    expect(
      screen.getByText("Get guided perspective")
    ).toBeInTheDocument();
  });

  it("stops input at 500 characters", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    const textarea = screen.getByPlaceholderText(
      "This verse reminds me of..."
    );
    const longText = "a".repeat(500);
    fireEvent.change(textarea, { target: { value: longText } });
    expect(screen.getByText("500/500")).toBeInTheDocument();

    // Try to type beyond 500
    fireEvent.change(textarea, {
      target: { value: longText + "b" },
    });
    // Should still be 500 — onChange handler clamps
    expect(textarea).toHaveValue(longText);
  });

  it("preserves reflection text between expand/collapse", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    const textarea = screen.getByPlaceholderText(
      "This verse reminds me of..."
    );
    fireEvent.change(textarea, {
      target: { value: "This verse changed my perspective on duty" },
    });
    // Collapse
    fireEvent.click(screen.getByText("Reflect"));
    // Expand again
    fireEvent.click(screen.getByText("Reflect"));
    expect(
      screen.getByDisplayValue(
        "This verse changed my perspective on duty"
      )
    ).toBeInTheDocument();
  });

  it("shows correct hint text", () => {
    renderPrompt();
    fireEvent.click(screen.getByText("Reflect"));
    expect(
      screen.getByText(/Your reflection helps personalize AI guidance/)
    ).toBeInTheDocument();
  });
});
