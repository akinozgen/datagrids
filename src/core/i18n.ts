import { warn } from "./warn";

export interface Messages {
  search: string;
  searchLabel: string;
  clear: string;
  loading: string;
  empty: string;
  emptyText: string;
  noMatch: string;
  noMatchText: string;
  clearSearch: string;
  error: string;
  errorText: string;
  retry: string;
  manual: string;
  manualText: string;
  load: string;
  records: string;
  /** "51–75 / 340 records (total 1,234)" — numbers already formatted. */
  info: (from: string, to: string, filtered: string, total: string | null) => string;
  infoUnknown: (from: string, to: string) => string;
  totalUnknown: string;
  pageSize: string;
  page: string;
  pageOf: (total: string) => string;
  pagination: string;
  first: string;
  prev: string;
  next: string;
  last: string;
  all: string;
  skip: string;
  sortedAsc: (col: string) => string;
  sortedDesc: (col: string) => string;
  sortCleared: string;
  found: (n: string) => string;
  pageAnnounce: (p: string, n: string) => string;
  /** total unknown (simplePaginate, count: none) */
  pageAnnounceUnknown: (p: string) => string;
  regionLabel: string;
  errorDetail: string;
  errNetwork: string;
  errTimeout: string;
  errSession: string;
  errForbidden: string;
  errServer: (status: string) => string;
  errParse: string;
  confirmTitle: string;
  confirmOk: string;
  confirmCancel: string;
  actionDone: string;
  /** banner title for action / save errors (not a load error) */
  actionFailed: string;
  openRow: string;
}

export const en: Messages = {
  search: "Search…",
  searchLabel: "Search",
  clear: "Clear",
  loading: "Loading…",
  empty: "No records",
  emptyText: "There is nothing to show yet.",
  noMatch: "No matching records",
  noMatchText: "Try a different search term.",
  clearSearch: "Clear search",
  error: "Couldn't load the list",
  errorText: "Something went wrong while loading. You can try again.",
  retry: "Retry",
  manual: "List not loaded yet",
  manualText: "Load the list when you need it.",
  load: "Load",
  records: "records",
  info: (f, t, filtered, total) => `${f}–${t} / ${filtered} records${total ? ` (total ${total})` : ""}`,
  infoUnknown: (f, t) => `${f}–${t} shown`,
  totalUnknown: "total unknown",
  pageSize: "Per page",
  page: "Page",
  pageOf: (n) => `of ${n}`,
  pagination: "Pagination",
  first: "First page",
  prev: "Previous page",
  next: "Next page",
  last: "Last page",
  all: "All",
  skip: "Skip table",
  sortedAsc: (c) => `Sorted by ${c}, ascending`,
  sortedDesc: (c) => `Sorted by ${c}, descending`,
  sortCleared: "Sorting cleared",
  found: (n) => `${n} records found`,
  pageAnnounce: (p, n) => `Page ${p} of ${n}`,
  pageAnnounceUnknown: (p) => `Page ${p}`,
  regionLabel: "Data table",
  errorDetail: "Details",
  errNetwork: "The server could not be reached. Check your connection.",
  errTimeout: "The server took too long to respond.",
  errSession: "Your session has expired. Please sign in again.",
  errForbidden: "You are not allowed to view this list.",
  errServer: (s) => `The server returned an error (${s}).`,
  errParse: "The server response could not be read.",
  confirmTitle: "Are you sure?",
  confirmOk: "Confirm",
  confirmCancel: "Cancel",
  actionDone: "Done.",
  actionFailed: "Action failed",
  openRow: "Open row",
};

export const tr: Messages = {
  search: "Ara…",
  searchLabel: "Ara",
  clear: "Temizle",
  loading: "Yükleniyor…",
  empty: "Kayıt yok",
  emptyText: "Henüz gösterilecek kayıt yok.",
  noMatch: "Eşleşen kayıt bulunamadı",
  noMatchText: "Farklı bir arama deneyin.",
  clearSearch: "Aramayı temizle",
  error: "Liste yüklenemedi",
  errorText: "Yüklenirken bir sorun oluştu. Yeniden deneyebilirsiniz.",
  retry: "Yeniden dene",
  manual: "Liste henüz yüklenmedi",
  manualText: "Listeyi gerektiğinde yükleyin.",
  load: "Yükle",
  records: "kayıt",
  info: (f, t, filtered, total) => `${f}–${t} / ${filtered} kayıt${total ? ` (toplam ${total})` : ""}`,
  infoUnknown: (f, t) => `${f}–${t} gösteriliyor`,
  totalUnknown: "toplam bilinmiyor",
  pageSize: "Sayfa başına",
  page: "Sayfa",
  pageOf: (n) => `/ ${n}`,
  pagination: "Sayfalama",
  first: "İlk sayfa",
  prev: "Önceki sayfa",
  next: "Sonraki sayfa",
  last: "Son sayfa",
  all: "Tümü",
  skip: "Tabloyu atla",
  sortedAsc: (c) => `Sıralama: ${c}, artan`,
  sortedDesc: (c) => `Sıralama: ${c}, azalan`,
  sortCleared: "Sıralama kaldırıldı",
  found: (n) => `${n} kayıt bulundu`,
  pageAnnounce: (p, n) => `Sayfa ${p} / ${n}`,
  pageAnnounceUnknown: (p) => `Sayfa ${p}`,
  regionLabel: "Veri tablosu",
  errorDetail: "Ayrıntı",
  errNetwork: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.",
  errTimeout: "Sunucu zamanında yanıt vermedi.",
  errSession: "Oturumunuz sona erdi. Lütfen yeniden giriş yapın.",
  errForbidden: "Bu listeyi görüntüleme yetkiniz yok.",
  errServer: (s) => `Sunucu bir hata döndürdü (${s}).`,
  errParse: "Sunucu yanıtı okunamadı.",
  confirmTitle: "Emin misiniz?",
  confirmOk: "Onayla",
  confirmCancel: "Vazgeç",
  actionDone: "İşlem tamamlandı.",
  actionFailed: "İşlem başarısız",
  openRow: "Satırı aç",
};

/** Merges partial host messages; undefined keys never override (selectable lesson). */
export function mergeMessages(base: Messages, ...over: Array<Partial<Messages> | undefined>): Messages {
  const out = { ...base } as Record<string, unknown>;
  for (const o of over) {
    if (!o) continue;
    for (const k in o) {
      const v = (o as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = v;
    }
  }
  return out as unknown as Messages;
}

/** A tag the Intl APIs accept, canonicalised; null for empty or invalid tags (`<html lang="1">`). */
export function canonicalLocale(tag: string | null | undefined): string | null {
  if (!tag) return null;
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/** First valid candidate, else the browser's language, else "en"; invalid candidates warn (DG015). */
export function resolveLocale(candidates: (string | null | undefined)[], quiet = false): string {
  for (const t of candidates) {
    if (!t) continue;
    const c = canonicalLocale(t);
    if (c) return c;
    if (!quiet) warn("DG015", { tag: t });
  }
  return canonicalLocale(typeof navigator !== "undefined" ? navigator.language : null) ?? "en";
}
