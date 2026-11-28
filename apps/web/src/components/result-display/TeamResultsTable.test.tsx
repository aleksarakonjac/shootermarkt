import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TeamResultsTable } from "./TeamResultsTable";
import type { TeamRow } from "@/lib/competition-teams";

vi.mock("next-intl", () => ({ useLocale: () => "sr" }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

const member = (name: string, shooterId: number | null) => ({ shooterId, name, series: [93, 97], total: "565.0", inners: 15 });
const team = (rank: number): TeamRow => ({ id: rank, teamName: `Klub ${rank}`, rank, total: "1691.0", inners: 32, remark: null,
  members: [member("Ninkovic Velimir", 7), member("Kondic Jovan", null), member("Dautovic Gabriel", null)] });

describe("TeamResultsTable", () => {
  it("opens a team to show its shooters one under another, linked ones to their profile", () => {
    render(<TeamResultsTable teams={[team(1)]} />);
    expect(screen.queryByText("Kondic")).toBeNull();
    const row = screen.getByRole("button", { name: /Klub 1/ });
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Ninkovic").closest("a")?.getAttribute("href")).toBe("/strelci/7");
    expect(screen.getByText("Kondic").closest("a")).toBeNull();
    expect(screen.getByText("1691")).toBeTruthy();
  });

  it("gives medals to the first three places only", () => {
    render(<TeamResultsTable teams={[team(1), team(4)]} />);
    expect(screen.getByLabelText("Mesto 1")).toBeTruthy();
    expect(screen.queryByLabelText("Mesto 4")).toBeNull();
  });
});

describe("TeamResultsTable names", () => {
  it("writes a linked shooter as in individual results: profile surname, then first name", () => {
    const linked = { ...team(1), members: [{ ...member("Ninkovic Velimir", 7), firstName: "Velimir", lastName: "NINKOVIĆ" }] };
    render(<TeamResultsTable teams={[linked]} />);
    fireEvent.click(screen.getByRole("button", { name: /Klub 1/ }));
    expect(screen.getByText("NINKOVIĆ").className).toContain("font-medium");
    expect(screen.getByText("Velimir").className).toContain("text-[var(--muted)]");
    expect(screen.queryByText("Ninkovic")).toBeNull();
  });
});
