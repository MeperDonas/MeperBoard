import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { PalettePicker } from "./palette-picker";
import { ACCENT_THEMES } from "../../lib/themes";

describe("PalettePicker", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.accent;
  });

  it("renders the trigger button with the active palette swatch", () => {
    render(<PalettePicker />);
    const button = screen.getByRole("button", { name: /change accent palette/i });
    expect(button).toBeInTheDocument();
  });

  it("opens the palette list and switches the accent theme on select", () => {
    render(<PalettePicker />);
    const button = screen.getByRole("button", { name: /change accent palette/i });

    // Open dropdown
    fireEvent.click(button);

    const listbox = screen.getByRole("listbox", { name: /color palettes/i });
    expect(listbox).toBeInTheDocument();

    // Select Terracotta Copper
    const terracottaOption = screen.getByRole("option", { name: /terracotta copper/i });
    fireEvent.click(terracottaOption);

    // Assert DOM updated and stored
    expect(document.documentElement.dataset.accent).toBe("terracotta");
    expect(window.localStorage.getItem("meperboard-accent")).toBe("terracotta");
  });
});
