import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomepageDataStatusProvider, useHomepageDataStatus } from "./homepage-data-status";

function Probe({ retry }: { retry: () => void }) {
  const { hasFailures, reportFailure, retryAll } = useHomepageDataStatus();
  return <><span>{hasFailures ? "failed" : "ready"}</span><button onClick={() => reportFailure("news", retry)}>fail</button><button onClick={retryAll}>retry</button></>;
}

describe("HomepageDataStatusProvider", () => {
  it("keeps failed requests available for the page-level retry", () => {
    const retry = vi.fn();
    render(<HomepageDataStatusProvider><Probe retry={retry} /></HomepageDataStatusProvider>);
    fireEvent.click(screen.getByText("fail"));
    expect(screen.getByText("failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(retry).toHaveBeenCalledOnce();
  });
});
