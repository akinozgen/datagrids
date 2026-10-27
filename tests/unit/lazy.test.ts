import { afterEach, describe, expect, it } from "vitest";
import { Datagrid, column, configure, serverSide, yajra, lazyColumns } from "../../src/index";

const tick = () => new Promise((r) => setTimeout(r, 5));
afterEach(() => configure({ fetch: undefined }));

describe("lazyColumns", () => {
  it("requests visible lazy keys only; showing one reloads the same page, hiding does not", async () => {
    const bodies: URLSearchParams[] = [];
    configure({
      fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
        const b = new URLSearchParams(String(init?.body ?? ""));
        bodies.push(b);
        const start = Number(b.get("start"));
        const data = Array.from({ length: 10 }, (_, i) => ({ id: start + i + 1, ad: `Kişi ${start + i + 1}`, vergi: "1234567890" }));
        return new Response(JSON.stringify({ draw: Number(b.get("draw")), recordsTotal: 30, recordsFiltered: 30, data }), { headers: { "Content-Type": "application/json" } });
      }) as typeof fetch,
    });
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      columns: [column.text("ad"), column.text("vergi", { visible: false, lazy: true })],
      pageSize: 10,
      use: [serverSide({ url: "/x", protocol: yajra() }), lazyColumns({ param: "ek_sutunlar" })],
    });
    await tick();
    expect(bodies.length).toBe(1);
    expect(bodies[0]!.getAll("ek_sutunlar[]")).toEqual([]);
    g.page(2);
    await tick();
    g.setColumnVisible("vergi", true);
    await tick();
    expect(bodies.length).toBe(3);
    expect(bodies[2]!.getAll("ek_sutunlar[]")).toEqual(["vergi"]);
    expect(bodies[2]!.get("start")).toBe("10");
    g.setColumnVisible("vergi", false);
    await tick();
    expect(bodies.length).toBe(3);
    // shown again: the last response already carries it → no request
    g.setColumnVisible("vergi", true);
    await tick();
    expect(bodies.length).toBe(3);
    expect((g as unknown as { lazyColumns: { requested(): string[] } }).lazyColumns.requested()).toEqual(["vergi"]);
    g.destroy();
  });
});
