// Overview: every demo section in one searchable grid (built from the sections on the page).
import { Datagrid, arraySource, column } from "@/index";
import type { Row } from "@/index";

const tones: Record<string, "info" | "ok" | "warn" | "muted"> = { Temel: "info", Görünüm: "ok", Sunucu: "warn", "Veri kaynakları": "warn", Modüller: "muted", Ekstra: "muted" };

export function buildOverview(): void {
  const main = document.getElementById("main")!;
  const nav = document.getElementById("nav")!;
  const rows: Row[] = [];
  let group = "";
  for (const el of Array.from(nav.children)) {
    if (el.classList.contains("group")) group = el.textContent ?? "";
    else if (el instanceof HTMLAnchorElement) {
      const id = el.getAttribute("href")!.slice(1);
      const lead = document.querySelector(`#${CSS.escape(id)} > p.lead`)?.textContent ?? "";
      rows.push({ id, baslik: el.textContent ?? id, grup: group, ozet: lead.length > 150 ? `${lead.slice(0, 148)}…` : lead });
    }
  }
  const s = document.createElement("section");
  s.className = "demo";
  s.id = "genel-bakis";
  s.innerHTML = `<h2>Genel bakış</h2><p class="lead">Sayfadaki ${rows.length} bölümün listesi (bu tablo da kütüphanenin kendisi): başlığa tıklayınca bölüme gider. Arama Türkçe katlamalı; grup rozetine göre sıralanabilir.</p>`;
  const card = document.createElement("div");
  card.className = "demo-card";
  const t = document.createElement("table");
  card.append(t);
  s.append(card);
  main.prepend(s);
  const a = document.createElement("a");
  a.href = "#genel-bakis";
  a.textContent = "Genel bakış";
  nav.querySelector(".group")?.before(a);
  new Datagrid(t, {
    name: "genel-bakis",
    label: "Demo bölümleri",
    pageSize: 10,
    columns: [
      column.link("baslik", { title: "Bölüm", href: "#{id}" }),
      column.badge("grup", { title: "Grup", tones }),
      column.text("ozet", { title: "Ne gösteriyor", sortable: false }),
    ],
    use: [arraySource(rows)],
  });
}
