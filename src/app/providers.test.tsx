import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Providers } from "./providers";

function QueryProbe() {
  const client = useQueryClient();
  client.setQueryData(["probe"], { ok: true });
  const data = client.getQueryData<{ ok: boolean }>(["probe"]);
  return <span data-testid="query-probe">{data?.ok ? "functional" : "broken"}</span>;
}

function DndProbe() {
  return <span data-testid="dnd-probe">board-root</span>;
}

describe("app providers", () => {
  it("provides a functional TanStack Query client to descendants", () => {
    render(
      <Providers>
        <QueryProbe />
      </Providers>,
    );

    expect(screen.getByTestId("query-probe")).toHaveTextContent("functional");
  });

  it("renders children through the dnd-kit DndContext", () => {
    render(
      <Providers>
        <DndProbe />
      </Providers>,
    );

    expect(screen.getByTestId("dnd-probe")).toHaveTextContent("board-root");
  });
});
