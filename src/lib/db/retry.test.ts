import { describe, expect, it, vi } from "vitest";
import { retryDatabaseRead } from "./retry";

describe("retryDatabaseRead", () => {
  it("retries one transient connection failure", async () => {
    const read = vi.fn().mockRejectedValueOnce({ code: "CONNECT_TIMEOUT" }).mockResolvedValueOnce("ok");
    await expect(retryDatabaseRead(read)).resolves.toBe("ok");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not retry query failures", async () => {
    const read = vi.fn().mockRejectedValue({ code: "57014" });
    await expect(retryDatabaseRead(read)).rejects.toEqual({ code: "57014" });
    expect(read).toHaveBeenCalledOnce();
  });
});
