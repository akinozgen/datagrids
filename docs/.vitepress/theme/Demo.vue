<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { snippets, FAULTS } from "./snippets";
import type { LogEntry } from "./server";

const props = defineProps<{
  /** snippet id: docs/.vitepress/snippets/<id>.js (+ .html) */
  id: string;
  /** fault buttons, comma separated: 500,419,302,error200,422,timeout */
  faults?: string;
  /** extra server switches: "count" (dgp count mode), "simple" (simplePaginate) */
  switches?: string;
}>();

const snippet = snippets[props.id];
if (!snippet) throw new Error(`[Demo] unknown snippet "${props.id}"`);

const isServer = /["'`]\/api\//.test(snippet.js);
const faultList = (props.faults ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const switchList = (props.switches ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const stage = ref<HTMLElement | null>(null);
const error = ref("");
const tab = ref<"code" | "request" | "response">("code");
const log = shallowRef<LogEntry[]>([]);
const editing = ref(false);
const draft = ref(snippet.js);
const pending = ref<string | null>(null);
const countMode = ref<"exact" | "none">("exact");
const simple = ref(false);
let alive = true;

const last = computed(() => log.value[0] ?? null);
const lastDone = computed(() => log.value.find((e) => e.status !== null || e.error) ?? null);

function onLog(e: LogEntry) {
  if (!alive) return;
  const list = log.value.filter((x) => x.n !== e.n);
  list.unshift(e);
  list.sort((a, b) => b.n - a.n);
  log.value = list.slice(0, 12);
}

async function start(code = snippet.js) {
  error.value = "";
  const el = stage.value;
  if (!el) return;
  try {
    const { run } = await import("./runtime");
    await run(el, snippet.html, code, onLog);
  } catch (e) {
    error.value = String((e as Error)?.stack?.split("\n").slice(0, 3).join("\n") ?? e);
  }
}

async function reloadGrids() {
  const { loadLib } = await import("./runtime");
  const lib = await loadLib();
  stage.value?.querySelectorAll("table").forEach((t) => void lib.Datagrid.get(t)?.reload({ keepPage: true }));
}

async function inject(kind: string) {
  const { loadServer } = await import("./runtime");
  const srv = await loadServer();
  srv.faults.next = kind;
  pending.value = kind;
  await reloadGrids();
  pending.value = null;
}

async function setCount(mode: "exact" | "none") {
  const { loadServer } = await import("./runtime");
  (await loadServer()).faults.countMode = mode;
  countMode.value = mode;
  await reloadGrids();
}

async function setSimple(on: boolean) {
  const { loadServer } = await import("./runtime");
  (await loadServer()).faults.simple = on;
  simple.value = on;
  await reloadGrids();
}

function runDraft() {
  log.value = [];
  void start(draft.value);
}

function resetDraft() {
  draft.value = snippet.js;
  log.value = [];
  void start();
}

const HEADERS = ["content-type", "accept", "x-requested-with", "x-csrf-token"];
const pickHeaders = (h: Record<string, string>) => Object.fromEntries(HEADERS.filter((k) => h[k]).map((k) => [k, h[k]]));

/** Long arrays (rows) are cut to the first two items so the shape stays readable. */
function trim(v: unknown, depth = 0): unknown {
  if (Array.isArray(v)) {
    const keep = v.length > 3 && depth < 3 && typeof v[0] === "object" ? 2 : v.length;
    const out = v.slice(0, keep).map((x) => trim(x, depth + 1));
    if (keep < v.length) out.push(`… ${v.length - keep} more`);
    return out;
  }
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = trim(x, depth + 1);
    return o;
  }
  return v;
}
const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(trim(v), null, 2));

onMounted(() => {
  void start();
});

onBeforeUnmount(async () => {
  alive = false;
  const el = stage.value;
  if (!el) return;
  const { teardown } = await import("./runtime");
  await teardown(el);
});
</script>

<template>
  <div class="dgd" :data-demo="id">
    <div class="dgd-stage" ref="stage"></div>
    <pre v-if="error" class="dgd-error" role="alert">{{ error }}</pre>
    <div v-if="faultList.length || switchList.length" class="dgd-sim">
      <span class="dgd-sim-label">Simulate</span>
      <button
        v-for="f in faultList"
        :key="f"
        type="button"
        class="dgd-chip"
        :aria-pressed="pending === f"
        @click="inject(f)"
      >{{ FAULTS[f] ?? f }}</button>
      <template v-if="switchList.includes('count')">
        <button type="button" class="dgd-chip" :aria-pressed="countMode === 'exact'" @click="setCount('exact')">count: exact</button>
        <button type="button" class="dgd-chip" :aria-pressed="countMode === 'none'" @click="setCount('none')">count: none</button>
      </template>
      <template v-if="switchList.includes('simple')">
        <button type="button" class="dgd-chip" :aria-pressed="!simple" @click="setSimple(false)">paginate()</button>
        <button type="button" class="dgd-chip" :aria-pressed="simple" @click="setSimple(true)">simplePaginate()</button>
      </template>
    </div>
    <div class="dgd-bar">
      <div class="dgd-tabs" role="tablist" aria-label="Demo source">
        <button type="button" role="tab" :aria-selected="tab === 'code'" @click="tab = 'code'">Code</button>
        <template v-if="isServer">
          <button type="button" role="tab" :aria-selected="tab === 'request'" @click="tab = 'request'">
            Request<span v-if="log.length" class="dgd-count">{{ log.length }}</span>
          </button>
          <button type="button" role="tab" :aria-selected="tab === 'response'" @click="tab = 'response'">Response</button>
        </template>
      </div>
      <button type="button" class="dgd-edit" :aria-pressed="editing" @click="editing = !editing">
        {{ editing ? "Close editor" : "Edit" }}
      </button>
    </div>
    <div v-if="editing" class="dgd-editor">
      <textarea v-model="draft" spellcheck="false" aria-label="Demo code" rows="14"></textarea>
      <div class="dgd-editor-actions">
        <button type="button" class="dgd-chip" data-primary @click="runDraft">Run</button>
        <button type="button" class="dgd-chip" @click="resetDraft">Reset</button>
        <span class="dgd-hint">Imports from <code>@akinozgen17/datagrids</code> and <code>./data.js</code> work here.</span>
      </div>
    </div>
    <div v-show="tab === 'code'" class="dgd-code"><slot /></div>
    <div v-if="isServer && tab === 'request'" class="dgd-panel">
      <p v-if="!log.length" class="dgd-empty">No request yet.</p>
      <template v-else>
        <ol class="dgd-reqs">
          <li v-for="e in log" :key="e.n" :data-error="e.error ? '' : null">
            <code>{{ e.method }}</code> <span class="dgd-url">{{ e.url.split("?")[0] }}</span>
            <span class="dgd-status">{{ e.error ? e.error : e.status === null ? "pending…" : `${e.status} · ${e.ms} ms` }}</span>
          </li>
        </ol>
        <div v-if="last" class="dgd-detail">
          <div class="dgd-h">Latest request: <code>{{ last.method }} {{ last.url.length > 120 ? last.url.slice(0, 120) + "…" : last.url }}</code></div>
          <div class="dgd-h">Headers</div>
          <pre>{{ pretty(pickHeaders(last.headers)) }}</pre>
          <div class="dgd-h">{{ last.method === "GET" ? "Query (decoded)" : "Body (decoded)" }}</div>
          <pre>{{ pretty(last.body) }}</pre>
          <template v-if="last.raw && !last.raw.startsWith('{')">
            <div class="dgd-h">Raw body</div>
            <pre class="dgd-raw">{{ last.raw.length > 600 ? last.raw.slice(0, 600) + "…" : last.raw }}</pre>
          </template>
        </div>
      </template>
    </div>
    <div v-if="isServer && tab === 'response'" class="dgd-panel">
      <p v-if="!lastDone" class="dgd-empty">No response yet.</p>
      <template v-else>
        <div class="dgd-h">
          <template v-if="lastDone.error">{{ lastDone.error }}</template>
          <template v-else>HTTP {{ lastDone.status }} · {{ lastDone.ms }} ms · long arrays are cut to 2 items</template>
        </div>
        <pre v-if="!lastDone.error">{{ pretty(lastDone.response) }}</pre>
      </template>
    </div>
  </div>
</template>
