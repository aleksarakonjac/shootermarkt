import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const params = vi.hoisted(() => ({ locale: "sr" }));
vi.mock("next/navigation", () => ({ useParams: () => params }));

import { OlympicQuotaNote } from "./OlympicQuotaBadge";

describe("OlympicQuotaNote", () => {
  it("names the country and the shooter in English", () => {
    params.locale = "en";
    render(<OlympicQuotaNote name="Ana Kovac" noc="IND" disciplineCode="ARW" />);
    expect(screen.getByText(/Quota for India won by/)).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with the IOC\.$/)).toBeInTheDocument();
  });

  it("names the country in Serbian", () => {
    params.locale = "sr";
    render(<OlympicQuotaNote name="Ana Kovac" noc="SRB" />);
    expect(screen.getByText(/Kvota države Srbija osvojena:/)).toBeInTheDocument();
  });
});
