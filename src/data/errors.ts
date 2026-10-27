// One error shape for every server failure (8 known response shapes → DatagridError).
import type { DatagridError } from "../core/types";
import type { Messages } from "../core/i18n";

const isJson = (r: Response) => /json/i.test(r.headers.get("content-type") ?? "");

function pickMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (typeof b.detail === "string" && typeof b.title === "string") return b.title; // RFC 9457
  if (typeof b.message === "string" && b.message) return b.message;
  if (typeof b.mesaj === "string" && b.mesaj) return b.mesaj;
  if (typeof b.error === "string" && b.error) return b.error;
  const errs = b.errors as Record<string, unknown> | undefined;
  if (errs && typeof errs === "object") {
    const first = Object.values(errs)[0];
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return undefined;
}

/** Turns a non-OK (or redirected) fetch Response into a DatagridError; null when it is fine. */
export async function httpError(res: Response, m: Messages): Promise<DatagridError | null> {
  const redirected = res.redirected && !isJson(res);
  if (res.ok && !redirected) return null;
  let body: unknown = null;
  try {
    body = isJson(res) ? await res.clone().json() : await res.clone().text();
  } catch {
    /* ignore */
  }
  const s = res.status;
  if (redirected) {
    const toLogin = /login|giris|signin/i.test(res.url);
    return { kind: toLogin ? "session" : "forbidden", status: s, message: toLogin ? m.errSession : m.errForbidden, retryable: false, raw: body };
  }
  if (s === 419 || s === 401) return { kind: "session", status: s, message: m.errSession, retryable: false, raw: body };
  if (s === 403) return { kind: "forbidden", status: s, message: pickMessage(body) ?? m.errForbidden, retryable: false, raw: body };
  if (s === 422) return { kind: "validation", status: s, message: pickMessage(body) ?? m.errServer(String(s)), retryable: false, raw: body };
  if (s === 410) return { kind: "protocol", status: s, message: pickMessage(body) ?? m.errServer(String(s)), retryable: false, raw: body };
  if (s === 429) return { kind: "http", status: s, message: pickMessage(body) ?? m.errServer(String(s)), retryable: true, raw: body };
  const msg = pickMessage(body);
  return {
    kind: "http",
    status: s,
    message: m.errServer(String(s)),
    detail: msg && msg !== "Server Error" ? msg : typeof body === "string" ? body.slice(0, 500) : undefined,
    retryable: s >= 500,
    raw: body,
  };
}

/** Maps fetch rejections (network, timeout, abort). */
export function fetchError(e: unknown, m: Messages): DatagridError {
  const err = e as Error;
  if (err?.name === "AbortError") return { kind: "abort", status: null, message: "aborted", retryable: true };
  if (err?.name === "TimeoutError") return { kind: "timeout", status: null, message: m.errTimeout, retryable: true };
  return { kind: "network", status: null, message: m.errNetwork, detail: err?.message, retryable: true };
}

/** 200 responses that still carry an error (yajra debug `error`, `status:'error'`). */
export function bodyError(body: Record<string, unknown>, m: Messages): DatagridError | null {
  const e = body.error ?? body.sError;
  if (e) {
    const text = typeof e === "string" ? e : undefined;
    // yajra debug text ("Exception Message:\n\n<SQL>") must never reach the UI
    return { kind: "server", status: 200, message: m.errServer("200"), detail: text, retryable: true, raw: body };
  }
  if (body.status === "error" && (typeof body.message === "string" || typeof body.mesaj === "string")) {
    return { kind: "server", status: 200, message: String(body.message ?? body.mesaj), retryable: true, raw: body };
  }
  return null;
}
