import { describe, expect, it } from "vitest";
import { isPublicationDue } from "./publication";

describe("fecha de publicación", () => {
  it("respeta la medianoche argentina aunque UTC ya esté en el día siguiente", () => {
    expect(isPublicationDue("2026-10-10", new Date("2026-10-10T02:59:59Z"))).toBe(false);
    expect(isPublicationDue("2026-10-10", new Date("2026-10-10T03:00:00Z"))).toBe(true);
    expect(isPublicationDue("2026-10-09", new Date("2026-10-10T02:59:59Z"))).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-01", "invalid", ""])(
    "rechaza fechas inválidas: %s",
    (date) => expect(isPublicationDue(date)).toBe(false),
  );
});
