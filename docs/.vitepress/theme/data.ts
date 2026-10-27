// Docs demo data: the deterministic generator from demo/data.ts, presented with English keys and values.
// Snippets import these as `./data.js` (the runtime maps that import here). Synthetic data only.
import { people } from "../../../demo/data";

export type Status = "open" | "done" | "pending" | "cancelled" | "draft";

export interface Agent {
  id: number;
  ref: string;
  name: string;
  unit: string;
  task: string;
  status: Status;
  amount: number;
  date: string;
  place: string;
  [k: string]: unknown;
}

const UNIT: Record<string, string> = {
  "S.T.A.R.S. Alfa": "S.T.A.R.S. Alpha",
  "S.T.A.R.S. Bravo": "S.T.A.R.S. Bravo",
  "R.P.D.": "R.P.D.",
  "Şemsiye A.Ş.": "Umbrella Corp.",
  "B.S.A.A.": "B.S.A.A.",
  "U.B.C.S.": "U.B.C.S.",
  "Bağımsız": "Independent",
  "Sivil": "Civilian",
};

const TASK: Record<string, string> = {
  "Spencer Malikanesi doğu kanadı keşfi ve harita güncellemesi": "Survey the Spencer Mansion east wing and update the map",
  "Yeşil Ot teslimi": "Green Herb delivery",
  "Işık Kulesi devriyesi, gece vardiyası": "Light Tower patrol, night shift",
  "Raccoon City kuzey çıkışı tahliye listesi": "Raccoon City north exit evacuation list",
  "NEST laboratuvarı erişim denetimi": "NEST lab access audit",
  "Kırmızı Ot karışımı stok sayımı": "Red Herb mixture stock count",
  "Mühimmat dolabı ve Mürekkep Şeridi sayımı": "Ammo locker and Ink Ribbon count",
  "Örnek transferi gözetimi": "Sample transfer oversight",
  "Helikopter bakım kaydı": "Helicopter maintenance log",
  "Saat kulesi çevresi güvenlik taraması": "Clock tower perimeter sweep",
  "Karakol arşivi dijitalleştirme": "Digitize the precinct archive",
  "Çiftlik evi bölgesi gözlem raporu": "Farmhouse area observation report",
};

const PLACE: Record<string, string> = {
  "Raccoon City": "Raccoon City",
  "Spencer Malikanesi": "Spencer Mansion",
  NEST: "NEST",
  "Işık Kulesi": "Light Tower",
  "Arklay Dağları": "Arklay Mountains",
  "Rockfort Adası": "Rockfort Island",
};

const STATUS: Record<string, Status> = { acik: "open", tamam: "done", bekliyor: "pending", iptal: "cancelled", taslak: "draft" };

/** `n` deterministic records (same seed → same rows). */
export function agents(n = 60, seed = 7): Agent[] {
  return people(n, seed).map((p) => ({
    id: p.id,
    ref: p.kayit,
    name: p.ad,
    unit: UNIT[p.birim] ?? p.birim,
    task: TASK[p.gorev] ?? p.gorev,
    status: STATUS[p.durum] ?? "open",
    amount: p.tutar,
    date: p.tarih,
    place: PLACE[p.mekan] ?? p.mekan,
  }));
}

export const statusLabels: Record<Status, string> = {
  open: "Open",
  done: "Done",
  pending: "Pending",
  cancelled: "Cancelled",
  draft: "Draft",
};

export const statusTones = { open: "info", done: "ok", pending: "warn", cancelled: "bad", draft: "neutral" } as const;

export const units = Object.values(UNIT);

/** The original (Turkish-language) records, for localization demos. */
export { people as turkishRecords };
