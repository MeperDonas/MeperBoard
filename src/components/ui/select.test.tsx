import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./select";

const OPTIONS = [
  { value: "all", label: "All types" },
  { value: "issue", label: "Issues" },
  { value: "pull", label: "Pull requests" },
];

function renderSelect(overrides: Partial<Parameters<typeof Select>[0]> = {}) {
  const onValueChange = vi.fn();
  const utils = render(
    <Select
      options={OPTIONS}
      value="all"
      onValueChange={onValueChange}
      aria-label="Test select"
      {...overrides}
    />,
  );
  const trigger = screen.getByRole("combobox", { name: "Test select" });
  return { ...utils, onValueChange, trigger };
}

function openListbox() {
  const { trigger } = renderSelect();
  fireEvent.click(trigger);
  return screen.getByRole("listbox", { name: "Test select" });
}

describe("Select", () => {
  it("renders a combobox trigger showing the selected label, closed", () => {
    const { trigger } = renderSelect();

    expect(trigger).toHaveAccessibleName("Test select");
    expect(trigger).toHaveTextContent("All types");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a themed listbox with the selected option marked", () => {
    const listbox = openListbox();
    const options = screen.getAllByRole("option");

    expect(listbox).toBeInTheDocument();
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).not.toHaveAttribute("aria-selected", "true");
    // Combobox pattern: focus stays on the trigger, roving via activedescendant.
    expect(trigger()).toHaveAttribute("aria-activedescendant", options[0].id);

    function trigger(): HTMLElement {
      return screen.getByRole("combobox", { name: "Test select" });
    }
  });

  it("selects an option by click and closes the panel immediately", () => {
    const { onValueChange } = renderSelect();
    fireEvent.click(screen.getByRole("combobox", { name: "Test select" }));
    fireEvent.click(screen.getByRole("option", { name: "Pull requests" }));

    expect(onValueChange).toHaveBeenCalledWith("pull");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("re-selecting the current value just closes without firing change", () => {
    const { onValueChange } = renderSelect();
    fireEvent.click(screen.getByRole("combobox", { name: "Test select" }));
    fireEvent.click(screen.getByRole("option", { name: "All types" }));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("toggles closed when the trigger is clicked again", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox", { name: "Test select" });
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  describe("keyboard", () => {
    it("opens with Enter/Space/ArrowDown and closes with Escape, restoring focus", () => {
      const { trigger } = renderSelect({ value: "issue" });

      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it("navigates with arrows, jumps with Home/End, selects with Enter", () => {
      const { onValueChange, trigger } = renderSelect();

      fireEvent.keyDown(trigger, { key: "Enter" });
      fireEvent.keyDown(trigger, { key: "End" });
      let options = screen.getAllByRole("option");
      expect(trigger).toHaveAttribute("aria-activedescendant", options[2].id);

      fireEvent.keyDown(trigger, { key: "Home" });
      options = screen.getAllByRole("option");
      expect(trigger).toHaveAttribute("aria-activedescendant", options[0].id);

      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      options = screen.getAllByRole("option");
      expect(trigger).toHaveAttribute("aria-activedescendant", options[2].id);

      fireEvent.keyDown(trigger, { key: "Enter" });
      expect(onValueChange).toHaveBeenCalledWith("pull");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("does not navigate past the first or last option", () => {
      renderSelect();
      const trigger = screen.getByRole("combobox", { name: "Test select" });
      fireEvent.keyDown(trigger, { key: "ArrowUp" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });

      const options = screen.getAllByRole("option");
      expect(trigger).toHaveAttribute("aria-activedescendant", options[2].id);
    });

    it("jumps with typeahead to labels starting with the typed text", () => {
      const { onValueChange, trigger } = renderSelect();

      fireEvent.keyDown(trigger, { key: "p" }); // opens? no — typeahead only while open
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

      fireEvent.keyDown(trigger, { key: " " }); // open
      fireEvent.keyDown(trigger, { key: "p" }); // typeahead → "Pull requests"
      const options = screen.getAllByRole("option");
      expect(trigger).toHaveAttribute("aria-activedescendant", options[2].id);

      fireEvent.keyDown(trigger, { key: "Enter" });
      expect(onValueChange).toHaveBeenCalledWith("pull");
    });

    it("closes with Tab without selecting", () => {
      const { onValueChange } = renderSelect();
      const trigger = screen.getByRole("combobox", { name: "Test select" });

      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: "Tab" });

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  it("closes on pointer-down outside", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox", { name: "Test select" });
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // Outside clicks move focus naturally; no forced refocus.
  });
});
