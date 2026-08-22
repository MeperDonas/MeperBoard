import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent", () => {
  it("renders markdown as HTML nodes (strong, list, link), not raw text", () => {
    render(<MarkdownContent content={"**bold**\n\n- item\n\n[link](https://x.example)"} />);

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByRole("listitem")).toHaveTextContent("item");
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://x.example");
    expect(screen.queryByText("**bold**")).not.toBeInTheDocument();
  });

  it("strips dangerous HTML so script/iframe/event handlers never become DOM nodes", () => {
    const { container } = render(
      <MarkdownContent
        content={
          '<script>alert(1)</script><iframe src="https://x"></iframe><img src=x onerror=alert(2)>'
        }
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("renders a placeholder for empty or whitespace-only body", () => {
    const { rerender } = render(<MarkdownContent content="" />);
    expect(screen.getByText("No description provided.")).toBeInTheDocument();

    rerender(<MarkdownContent content="   " />);
    expect(screen.getByText("No description provided.")).toBeInTheDocument();
  });
});
