import { column } from "@/index";
import type { ColumnDef, Datagrid } from "@/index";
import { durumLabels, durumTones } from "./data";

declare global {
  interface Window {
    grids: Record<string, Datagrid>;
  }
}
window.grids = window.grids ?? {};

const nav = () => document.getElementById("nav")!;
const main = () => document.getElementById("main")!;
let currentGroup = "";

/** Adds a demo section (nav link + card) and returns the card element. */
export function section(id: string, title: string, lead: string, group: string): HTMLElement {
  if (group !== currentGroup) {
    currentGroup = group;
    const g = document.createElement("div");
    g.className = "group";
    g.textContent = group;
    nav().append(g);
  }
  const a = document.createElement("a");
  a.href = `#${id}`;
  a.textContent = title;
  nav().append(a);
  const s = document.createElement("section");
  s.className = "demo";
  s.id = id;
  const h2 = document.createElement("h2");
  h2.textContent = title;
  const p = document.createElement("p");
  p.className = "lead";
  p.textContent = lead;
  s.append(h2, p);
  const card = document.createElement("div");
  card.className = "demo-card";
  s.append(card);
  main().append(s);
  return card;
}

export function table(parent: HTMLElement, id: string): HTMLTableElement {
  const t = document.createElement("table");
  t.id = id;
  parent.append(t);
  return t;
}

/** Small toolbar of demo buttons above a grid. */
export function tools(parent: HTMLElement, buttons: Record<string, () => void>): HTMLElement {
  const box = document.createElement("div");
  box.className = "demo-tools";
  for (const [label, fn] of Object.entries(buttons)) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", fn);
    box.append(b);
  }
  parent.append(box);
  return box;
}

/** Log box under a grid (events, requests). */
export function log(parent: HTMLElement): (line: string) => void {
  const pre = document.createElement("div");
  pre.className = "demo-log";
  // scrollable once it fills up: keyboard reachable (axe scrollable-region-focusable)
  pre.tabIndex = 0;
  pre.setAttribute("role", "log");
  pre.setAttribute("aria-label", "Günlük");
  parent.append(pre);
  return (line) => {
    pre.textContent = `${line}\n${pre.textContent}`.slice(0, 4000);
  };
}

export const baseColumns = (): ColumnDef[] => [
  column.index(),
  column.text("kayit", {
    title: "Kayıt",
    render: (v) => {
      const s = document.createElement("span");
      s.className = "dg-id";
      s.textContent = String(v);
      return s;
    },
  }),
  column.text("ad", {
    title: "Personel",
    render: (v, row) => {
      const wrap = document.createElement("div");
      wrap.className = "dg-user";
      const av = document.createElement("span");
      av.className = "dg-avatar";
      av.textContent = String(v).split(" ").map((p) => p[0]).slice(0, 2).join("");
      const body = document.createElement("div");
      body.className = "dg-user-body";
      const n = document.createElement("a");
      n.className = "dg-link dg-user-name";
      n.href = `#kisi-${row.id}`;
      n.textContent = String(v);
      n.dir = "auto";
      const sub = document.createElement("span");
      sub.className = "dg-sub";
      sub.textContent = String(row.birim);
      sub.dir = "auto";
      body.append(n, sub);
      wrap.append(av, body);
      return wrap;
    },
    searchText: (v, row) => `${v} ${row.birim}`,
  }),
  column.text("gorev", { title: "Görev" }),
  column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
  column.money("tutar", { title: "Tutar" }),
  column.date("tarih", { title: "Tarih", time: true }),
];
