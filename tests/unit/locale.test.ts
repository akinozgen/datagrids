import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalLocale, resolveLocale } from "../../src/core/i18n";
import { Datagrid, column, arraySource } from "../../src/index";

const mount = () => {
  document.body.innerHTML = `<table id="t"></table>`;
  return document.getElementById("t") as HTMLTableElement;
};
const make = (o: Record<string, unknown> = {}) =>
  new Datagrid(mount(), { label: "Liste", columns: [column.text("ad"), column.money("tutar")], use: [arraySource([{ id: 1, ad: "Jill", tutar: 1234.5 }])], ...o });

afterEach(() => {
  Datagrid.get("#t")?.destroy();
  document.documentElement.lang = "tr";
  vi.restoreAllMocks();
});

describe("locale resolution", () => {
  it("canonicalises valid tags and rejects invalid ones", () => {
    expect(canonicalLocale("tr-tr")).toBe("tr-TR");
    expect(canonicalLocale("1")).toBeNull();
    expect(canonicalLocale("")).toBeNull();
    expect(canonicalLocale(undefined)).toBeNull();
  });

  it("an invalid <html lang> warns once and falls back to the browser language", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
    document.documentElement.lang = "1";
    const g = make();
    expect(g.locale).toBe("de-DE");
    expect(g.messages.search).toBe("Search…");
    expect(spy.mock.calls.some(([m]) => String(m).includes("DG015") && String(m).includes("`1`"))).toBe(true);
  });

  it("falls back to en when the browser language is unusable too", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(navigator, "language", "get").mockReturnValue("");
    document.documentElement.lang = "";
    expect(make().locale).toBe("en");
    expect(resolveLocale(["x_bad"], true)).toBe("en");
  });

  it("an empty <html lang> follows the browser language", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(navigator, "language", "get").mockReturnValue("tr-TR");
    document.documentElement.lang = "";
    const g = make();
    expect(g.locale).toBe("tr-TR");
    expect(g.messages.search).toBe("Ara…");
  });

  it("an invalid locale option skips to the next candidate", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.documentElement.lang = "tr";
    expect(make({ locale: "@@" }).locale).toBe("tr");
  });

  it("the grid still renders formatted numbers after an invalid tag", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    document.documentElement.lang = "1";
    const g = make();
    await vi.waitFor(() => expect(g.root.querySelector("tbody td:last-child")?.textContent).toMatch(/1,234\.50/));
  });
});
