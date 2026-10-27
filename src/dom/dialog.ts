// Default confirm: grid-styled native <dialog>, no window.confirm.
import type { ConfirmOptions } from "../core/types";
import { frag, h } from "../core/util";
import { icons } from "./icons";

export interface ConfirmText {
  title: string;
  confirm: string;
  cancel: string;
}

/** Opens a modal confirm dialog inside `host` (keeps token inheritance) and resolves with the choice. */
export function confirmDialog(host: HTMLElement, message: string, o: ConfirmOptions, t: ConfirmText, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const danger = o.tone === "danger";
    const titleId = `dgd-${Math.random().toString(36).slice(2, 8)}`;
    const descId = `${titleId}-d`;
    const dlg = h("dialog", { class: "dg-dialog", "aria-labelledby": titleId, "aria-describedby": descId }) as HTMLDialogElement;
    const icon = h("span", { class: "dg-dialog-icon", "data-tone": danger ? "bad" : null });
    icon.append(frag(danger ? icons.alert : icons.info));
    const body = h(
      "div",
      { class: "dg-dialog-body" },
      icon,
      h("div", { class: "dg-dialog-title", id: titleId }, o.title ?? t.title),
      h("div", { class: "dg-dialog-text", id: descId }, message),
      o.subject ? h("div", { class: "dg-dialog-subject" }, o.subject) : null,
    );
    const cancel = h("button", { type: "button", class: "dg-btn", "data-act": "cancel" }, o.cancelLabel ?? t.cancel);
    const ok = h("button", { type: "button", class: "dg-btn", "data-variant": danger ? "danger" : "primary", "data-act": "ok" }, o.confirmLabel ?? t.confirm);
    dlg.append(body, h("div", { class: "dg-dialog-foot" }, cancel, ok));
    host.append(dlg);
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      if (dlg.open) dlg.close();
      dlg.remove();
      resolve(v);
    };
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(false);
    });
    dlg.addEventListener("close", () => finish(false));
    // the grid going away (destroy / remount) answers "no" instead of leaving the caller waiting
    signal?.addEventListener("abort", () => finish(false), { once: true });
    if (signal?.aborted) return finish(false);
    dlg.showModal();
    // destructive actions start on "Cancel"
    (danger ? cancel : ok).focus();
  });
}
