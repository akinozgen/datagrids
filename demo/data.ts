// Deterministic synthetic demo data (no real customer data, ever).
export interface Person {
  id: number;
  kayit: string;
  ad: string;
  birim: string;
  gorev: string;
  durum: "acik" | "tamam" | "bekliyor" | "iptal" | "taslak";
  tutar: number;
  tarih: string; // ISO
  telefon: string;
  mekan: string;
}

const PEOPLE = [
  "Jill Valentine", "Chris Redfield", "Leon S. Kennedy", "Claire Redfield", "Albert Wesker", "Rebecca Chambers",
  "Barry Burton", "Ada Wong", "Brad Vickers", "Carlos Oliveira", "Ethan Winters", "Sherry Birkin",
  "Ashley Graham", "Piers Nivans", "Moira Burton", "Helena Harper", "Jake Muller", "Sheva Alomar",
  "Billy Coen", "Annette Birkin", "Hunk", "Ark Thompson", "Kevin Ryman", "Cindy Lennox",
];
const UNITS = ["S.T.A.R.S. Alfa", "S.T.A.R.S. Bravo", "R.P.D.", "Şemsiye A.Ş.", "B.S.A.A.", "U.B.C.S.", "Bağımsız", "Sivil"];
const TASKS = [
  "Spencer Malikanesi doğu kanadı keşfi ve harita güncellemesi",
  "Yeşil Ot teslimi",
  "Işık Kulesi devriyesi, gece vardiyası",
  "Raccoon City kuzey çıkışı tahliye listesi",
  "NEST laboratuvarı erişim denetimi",
  "Kırmızı Ot karışımı stok sayımı",
  "Mühimmat dolabı ve Mürekkep Şeridi sayımı",
  "Örnek transferi gözetimi",
  "Helikopter bakım kaydı",
  "Saat kulesi çevresi güvenlik taraması",
  "Karakol arşivi dijitalleştirme",
  "Çiftlik evi bölgesi gözlem raporu",
];
const PLACES = ["Raccoon City", "Spencer Malikanesi", "NEST", "Işık Kulesi", "Arklay Dağları", "Rockfort Adası"];
const STATES: Person["durum"][] = ["acik", "tamam", "bekliyor", "iptal", "taslak"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function people(n: number, seed = 7): Person[] {
  const r = rng(seed);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const base = Date.UTC(2026, 9, 26, 9, 40);
  return Array.from({ length: n }, (_, i) => {
    const id = 1000 + n - i;
    const prefix = r() < 0.75 ? "RPD" : "UMB";
    const amount = Math.round((r() < 0.08 ? -1 : 1) * r() * 20000 * 100) / 100;
    return {
      id,
      kayit: `${prefix}-${2611 - i}`,
      ad: PEOPLE[i % PEOPLE.length]!,
      birim: pick(UNITS),
      gorev: pick(TASKS),
      durum: pick(STATES),
      tutar: amount,
      tarih: new Date(base - i * 3600_000 * (6 + Math.floor(r() * 30))).toISOString(),
      telefon: `0 5${30 + Math.floor(r() * 69)} ${String(100 + Math.floor(r() * 899))} ${String(10 + Math.floor(r() * 89))} ${String(10 + Math.floor(r() * 89))}`,
      mekan: pick(PLACES),
    };
  });
}

export const durumLabels: Record<Person["durum"], string> = {
  acik: "Açık",
  tamam: "Tamamlandı",
  bekliyor: "Beklemede",
  iptal: "İptal",
  taslak: "Taslak",
};
export const durumTones = { acik: "info", tamam: "ok", bekliyor: "warn", iptal: "bad", taslak: "neutral" } as const;
