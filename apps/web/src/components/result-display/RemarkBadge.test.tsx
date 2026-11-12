import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "sr" }) }));

import { RemarkBadge } from "./RemarkBadge";

describe("RemarkBadge", () => {
  it("opening and closing the remark modal does not trigger the clickable row underneath", () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <RemarkBadge remark="DSQ" label="Ana Kovac" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "DSQ" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zatvori" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("a click on the modal backdrop closes it without reaching the row", () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <RemarkBadge remark="DSQ" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "DSQ" }));
    fireEvent.click(screen.getByRole("dialog"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
