---
title: datagrids protocol v1
type: reference
description: Normative specification of the datagrids protocol (dgp) v1, a JSON protocol for paged, sorted and filtered lists with typed filters, optional counting and RFC 9457 errors.
---

# datagrids protocol v1

The datagrids protocol (dgp) is a small JSON protocol between a list UI and a server: the client
asks for one page of rows with a sort, a search text and typed filters; the server answers with the
rows, paging facts, optional counts and aggregates. It is what [`dgp()`](/guide/server-protocols)
speaks.

| Property | Value |
|---|---|
| Spec version | 1.0 (2026-10-27) |
| Status | Stable. Changes within v1 are additions only |
| JSON Schema (draft 2020-12) | [request.schema.json](/protocol/v1/request.schema.json) · [response.schema.json](/protocol/v1/response.schema.json) · [error.schema.json](/protocol/v1/error.schema.json) |
| Client | `serverSide({ url, protocol: dgp() })` |

Try it: change the sort, search, open a column filter (the funnel icon in a header), switch the
count mode, simulate an error, and read the **Request** and **Response** tabs.

<Demo id="proto-dgp" switches="count" faults="422,500" />

## 1. Overview and versioning

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY and OPTIONAL are to be
interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

Terms:

- **Client**: the code that builds requests and renders rows (for example a datagrids grid).
- **Server**: the endpoint that answers them.
- **Field**: a named value of a row (`name`, `amount`). Sort keys, filter keys and `fields` entries
  are field keys.
- **Schema**: the server's own list of fields it exposes, with their types and which of them are
  sortable, searchable and filterable. The schema lives on the server; the protocol never sends
  column definitions, SQL expressions or indexes.

Versioning:

1. Every request body MUST contain `"v": 1`. Every successful response body MUST contain `"v": 1`.
2. A server that receives a `v` it does not support MUST answer `400` with `code: "unsupported_version"`.
3. The spec version is independent of the datagrids library version. A library release states which
   protocol versions it speaks; this one speaks v1.
4. Within v1 the spec only grows: new OPTIONAL members, new error codes, new warning codes. A change
   that would make a conforming v1 peer fail is a new major version (`"v": 2`, a new `/protocol/v2/`
   page).
5. Both sides MUST ignore members they do not know, in every object. The JSON Schemas allow
   additional properties for this reason.

## 2. Transport

### 2.1 POST JSON (default)

- The client sends `POST <endpoint>` with `Content-Type: application/json` and a [request](#_3-request)
  body.
- The client SHOULD send `Accept: application/json, application/problem+json`.
- A successful answer is `200` with `Content-Type: application/json` and a [response](#_4-response) body.
- An error is a 4xx/5xx status with `Content-Type: application/problem+json` and an
  [error](#_5-errors) body.
- When the endpoint authenticates with cookies, the server SHOULD require a CSRF token header
  (`X-CSRF-TOKEN` in Laravel). The reference client sends it with `csrf: true`, together with
  `X-Requested-With: XMLHttpRequest`.

### 2.2 GET form (optional)

A server MAY also accept the same request as query parameters (`dgp({ method: "GET" })`), which
makes responses cacheable and links shareable. The mapping is flat:

| Request member | Query parameter | Example |
|---|---|---|
| `page.size`, `page.number` | `page[size]`, `page[number]` | `page[size]=25&page[number]=2` |
| `sort` | `sort`: comma list, `-` prefix = descending | `sort=-amount,name` |
| `q` | `q` | `q=kennedy` |
| `fields` | `fields`: comma list | `fields=name,unit,amount` |
| `count` | `count` | `count=none` |
| `filters.<key>` | `filter[<key>][<op>]=<value>`; list values comma-joined | `filter[status][in]=open,pending` |
| `params.<name>` | `<name>` (top level) | `_deleted=1` |

- Parameters are form-encoded (brackets and commas percent-encoded on the wire). `v` and
  `requestId` are not sent in the GET form; the endpoint path implies v1.
- All values arrive as strings. The server coerces them by the field's type in its schema.
- List values MUST NOT contain commas in the GET form. A client that needs them MUST use POST.
- `empty` and `notEmpty` carry an empty value: `filter[deleted_at][empty]=`.

## 3. Request

```json
{
  "v": 1,
  "page": { "size": 25, "number": 1 },
  "sort": [{ "key": "amount", "dir": "desc" }],
  "q": "kennedy",
  "filters": { "status": { "op": "in", "value": ["open", "pending"] } },
  "fields": ["name", "unit", "status", "amount", "date"],
  "count": "exact",
  "requestId": "r-12",
  "params": { "_deleted": 1 }
}
```

| Member | Type | Required | Meaning |
|---|---|---|---|
| `v` | `1` | REQUIRED | Protocol major version |
| `page` | `{ size, number }` | REQUIRED | `size`: integer ≥ 1. `number`: 1-based integer ≥ 1 |
| `sort` | `[{ key, dir }]` | OPTIONAL | Sort keys in priority order; `dir` is `asc` or `desc`. Missing or empty: the server's default order. See [Sorting](#_7-sorting) |
| `q` | string | OPTIONAL | Global search text. The client omits it when empty |
| `filters` | `{ <key>: { op, value } }` | OPTIONAL | Typed filters, combined with AND. See [Filtering](#_8-filtering) |
| `fields` | string[] | OPTIONAL | The fields the client renders. Missing: the server's default field set |
| `count` | `exact` \| `estimate` \| `none` | OPTIONAL | Counting the client asks for; missing means `exact`. See [Counting](#_6-counting) |
| `requestId` | string | OPTIONAL | Correlation id for logs. The server MAY echo it |
| `params` | object | OPTIONAL | Page-specific parameters that are not typed filters. Their meaning is server-defined |

Rules:

1. Servers MUST accept a request in which every OPTIONAL member is missing.
2. Servers MUST enforce a maximum page size. When `page.size` exceeds it, the server MUST either
   answer `422` with `code: "page_size_exceeded"`, or clamp the size, report the size it used in
   the response's `page.size` and add a `page_size_clamped` warning. A maximum of 1000 matches the
   reference client's default `maxPageSize`.
3. `fields` entries the server does not know SHOULD be ignored (and MAY be reported as a warning).
   `fields` never widens what the server exposes: see [Response](#_4-response) rule 3.
4. A `page.number` past the last page is not an error: the server answers `200` with an empty
   `rows` array and `hasMore: false`.

What the reference client puts where:

| Grid input | Request member |
|---|---|
| `grid.page()`, `grid.pageSize()` | `page.number`, `page.size` |
| `sort` option, header clicks, `grid.sort()` | `sort` (column keys) |
| The search box, `grid.search()` | `q` |
| `grid.filters({ status: "open" })` | `filters.status = { op: "eq", value: "open" }` |
| `grid.filters({ unit: ["R.P.D.", "U.B.C.S."] })` | `filters.unit = { op: "in", value: [...] }` |
| `grid.filters({ amount: { op: "gte", value: 100 } })`, `columnFilters()` | `filters.amount` as given |
| Columns (except index, select and actions columns) | `fields`: each column's `data` path, else its key |
| `dgp({ count })` | `count` (default `exact`) |
| `serverSide({ params })`, `filterPanel()`, `softDeletes()`, `lazyColumns()` | `params` (e.g. `params._deleted`, `params.lazy`) |
| `csrf: true` | `X-CSRF-TOKEN` header, and `_token` in `params` |

Function filters (`grid.filters({ key: (value, row) => … })`) are client-only and never sent.
Filters set to `null`, `""` or `[]` are removed and never sent.

### 3.1 Export requests (informative)

An export of "all matching rows" (`grid.exportRows("all")`, `excel({ scope: "all" })`) sends the same
request with `page: { size: <maxPageSize>, number: 1 }` (1000 by default). Servers SHOULD allow
that size. Larger exports belong to a separate endpoint: the page posts `grid.query()` there and the
server runs the same query in a job.

## 4. Response

```json
{
  "v": 1,
  "rows": [
    { "id": "1737", "name": "Cindy Lennox", "status": "pending", "amount": 19991.51 }
  ],
  "page": { "size": 25, "number": 1, "hasMore": true },
  "count": { "mode": "exact", "total": 1000, "filtered": 375 },
  "meta": {
    "aggregates": { "amount": { "sum": 3094860.95 } },
    "facets": {},
    "warnings": []
  }
}
```

| Member | Type | Required | Meaning |
|---|---|---|---|
| `v` | `1` | REQUIRED | Protocol major version |
| `rows` | object[] | REQUIRED | The page, in the requested order. May be empty |
| `page` | `{ size, number, hasMore }` | REQUIRED | The page actually returned. `hasMore` is `true` when a next page exists |
| `count` | `{ mode, total?, filtered? }` | REQUIRED | See [Counting](#_6-counting) |
| `meta` | `{ aggregates?, facets?, warnings? }` | OPTIONAL | Side data, see below |
| `requestId` | string | OPTIONAL | Echo of the request's `requestId` |

Rules:

1. Every row MUST have an `id` (string or integer) that is unique within the result and stable
   across requests. Clients compare ids as strings. Selection, row actions and row refreshes depend
   on it.
2. Values are typed data, not presentation: numbers as JSON numbers (or decimal strings such as
   `"1234.50"` when precision matters), dates and times as ISO 8601 strings with an offset
   (`"2026-09-01T10:00:00+03:00"`), booleans as `true`/`false`, missing values as `null`. Servers
   SHOULD NOT send HTML. Clients render cells as text unless a column opts in to HTML.
3. A row MUST NOT contain fields outside the server's schema. A server SHOULD return exactly the
   requested `fields` it knows, plus `id`. Never serialize whole models: what is not in the schema
   never leaves the server.
4. `meta.aggregates` holds raw numbers over every filtered row (not just the page), by field key and
   function: `{ "amount": { "sum": 3094860.95, "avg": 8252.96 } }`. Well-known functions: `sum`,
   `avg`, `min`, `max`, `count`.
5. `meta.facets` holds filter options by field key: `{ "unit": [{ "value": "rpd", "label": "R.P.D.", "count": 12 }] }`.
6. `meta.warnings` holds non-fatal notes as `{ code, message? }` objects, e.g.
   `{ "code": "page_size_clamped", "message": "Page size limited to 500." }`.

The reference client exposes the whole body as `grid.lastResponse()` and in the `response` event
(`result.meta` carries `meta` plus `countMode`), so [`metaBind()`](/modules/meta-bind) can write
`meta.aggregates.amount.sum` into the page, as the demo above does.

## 5. Errors

Every error is a [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details object, sent
with the matching HTTP status and `Content-Type: application/problem+json`.

```json
{
  "type": "about:blank",
  "title": "Invalid filter",
  "status": 422,
  "code": "validation_failed",
  "retryable": false,
  "errors": { "filters.date": ["The date range is invalid."] }
}
```

| Member | Type | Required | Meaning |
|---|---|---|---|
| `type` | URI reference | OPTIONAL | Problem type; `about:blank` when omitted |
| `title` | string | REQUIRED | Short summary, safe to show to end users |
| `status` | integer | REQUIRED | Same as the HTTP status |
| `detail` | string | OPTIONAL | Occurrence-specific diagnostics. Clients MUST NOT show it to end users |
| `instance` | URI reference | OPTIONAL | Identifies this occurrence (e.g. a log reference) |
| `code` | string | REQUIRED | Machine-readable, `snake_case` (extension member) |
| `retryable` | boolean | RECOMMENDED | Whether repeating the same request may succeed (extension member) |
| `errors` | `{ <path>: string[] }` | OPTIONAL | Validation messages by request path: `filters.date`, `sort.0.key`, `page.size` (extension member) |

Server rules:

1. Use the right status. Never answer an API request with a `302` redirect to an HTML login or
   "forbidden" page: answer `401` (or `419` for an expired CSRF session) or `403` with a problem body.
2. Never put stack traces, SQL or personal data in `title`. Prefer to keep them out of `detail` too.
3. Validation failures (unknown sort key, unsupported operator, malformed value, page too large)
   are `422` with `errors` keyed by request path.

Recommended codes:

| Status | `code` | `retryable` |
|---|---|---|
| 400 | `invalid_request`, `unsupported_version` | `false` |
| 401 / 419 | `session_expired` | `false` |
| 403 | `forbidden` | `false` |
| 422 | `validation_failed`, `unknown_sort_key`, `unknown_filter`, `unsupported_filter`, `page_size_exceeded` | `false` |
| 429 | `rate_limited` (with `Retry-After`) | `true` |
| 500 | `server_error` | `true` |
| 503 | `unavailable` | `true` |

How the reference client handles them (the same normalization applies to every protocol, see
[SSP → Errors](/protocol/ssp#errors)):

| Response | Error `kind` | Shown message | Retry button |
|---|---|---|---|
| `401`, `419` | `session` (+ `sessionexpired` event) | "Your session has expired…" | no |
| `302` to a non-JSON page | `session` if the URL looks like a login page, else `forbidden` | session / "You are not allowed…" | no |
| `403` | `forbidden` | problem message, else "You are not allowed…" | no |
| `422` | `validation` | problem message | no |
| `410` | `protocol` | problem message | no |
| `429` | `http` | problem message | yes |
| other 4xx | `http` | "The server returned an error (404)." | no |
| 5xx | `http` | "The server returned an error (500)." (server text only in `error.detail`) | yes |
| `200` with a body that is not JSON | `parse` | "The server response could not be read." | no |
| network failure, timeout | `network`, `timeout` | connection / timeout text | yes |

"Problem message" is `title` when the problem also has a `detail`, otherwise the first message in
`errors`, otherwise the generic text. The reference client decides retries from the status; it does
not read `retryable` or `code` yet. If the grid already shows rows, the error appears as a banner
above them; otherwise it replaces the body.

## 6. Counting

Counting a filtered result can cost more than fetching the page. The client says what it needs;
the server says what it did.

| `count.mode` | `total` | `filtered` | Meaning |
|---|---|---|---|
| `exact` | OPTIONAL | REQUIRED | Exact numbers. `filtered`: rows matching `q` and `filters`. `total`: rows before them |
| `estimate` | OPTIONAL | REQUIRED | Approximations (e.g. from the query planner) |
| `none` | absent | absent | Not counted |

1. The server MAY answer with a cheaper mode than requested (`exact` → `estimate` → `none`), never a
   more expensive one it was not asked for. `count.mode` MUST state what was done.
2. Clients MUST read `count.mode` from the response, not assume the requested one.
3. `page.hasMore` MUST be accurate in every mode. Without counts it is the only paging signal.
   Servers usually fetch `size + 1` rows to know it.
4. `total` and `filtered` are integers ≥ 0. Omit `total` when it costs an extra query you don't want.

How the reference client shows each mode:

| Mode | Info text | Pager |
|---|---|---|
| `exact` | "1–25 / 375 records (total 1,000)" | page field "of N", Last enabled |
| `estimate` | same as `exact` (numbers are not marked as approximate yet) | same as `exact` |
| `none` | "1–25 shown · total unknown" | Next while `hasMore`, Last disabled |

Switch **count: none** in the demo above to see the third row.

## 7. Sorting

1. `sort` is an ordered list; the first entry has the highest priority.
2. `key` is a field key from the server's schema, never a column index or an SQL expression.
3. The server MUST reject keys that are unknown or not sortable with `422` (`code:
   "unknown_sort_key"`, `errors["sort.<i>.key"]`). Never splice a key into SQL unchecked.
4. The server MUST produce a deterministic order and SHOULD append a unique tiebreaker (usually
   `id`) so rows don't move between pages.
5. A missing or empty `sort` means the server's default order (which also MUST be deterministic).
6. Where nulls sort is server-defined but MUST be consistent.

The reference client sends one key when a user clicks a header; a `sort` option with several
entries (`sort: [["unit", "asc"], ["amount", "desc"]]`) sends them all.

## 8. Filtering

`filters` maps a field key to one filter object `{ op, value }`. All filters MUST match (AND); v1 has
no OR groups and no nesting. `in` and `notIn` express "any of" within one field. `q` and `filters`
combine with AND.

| `op` | `value` | Matches rows whose field… |
|---|---|---|
| `eq` | scalar | equals the value |
| `ne` | scalar | does not equal the value (empty fields match) |
| `gt` / `gte` | number or date string | is greater than / at least the value |
| `lt` / `lte` | number or date string | is less than / at most the value |
| `between` | `[min, max]` | lies in the closed range `min ≤ field ≤ max` |
| `in` | non-empty array of scalars | equals any of the values |
| `notIn` | non-empty array of scalars | equals none of the values (empty fields match) |
| `contains` | string | contains the text |
| `notContains` | string | does not contain the text (empty fields match) |
| `starts` | string | starts with the text |
| `ends` | string | ends with the text |
| `empty` | none | is `null` or `""` |
| `notEmpty` | none | is neither `null` nor `""` |

Rules:

1. Scalars are strings, numbers or booleans. Dates are ISO 8601 strings: a date (`2026-09-01`) or a
   date-time with an offset.
2. Text operators (`contains`, `notContains`, `starts`, `ends`) SHOULD be case-insensitive and
   SHOULD ignore diacritics, so `isik` finds `Işık`. `eq` compares exactly after coercion to the
   field's type.
3. Negative operators (`ne`, `notIn`, `notContains`) MUST include rows whose field is empty. In SQL
   that means adding `OR field IS NULL`.
4. Comparison operators (`gt`, `gte`, `lt`, `lte`, `between`) never match an empty field.
5. A date-only value compared with a date-time field SHOULD cover the whole day in the server's
   business time zone: `eq 2026-09-01` matches that day, `between ["2026-09-01", "2026-09-30"]`
   includes all of September 30.
6. `empty` and `notEmpty` take no value; servers MUST ignore one if present.
7. The server MUST validate every filter against its schema: an unknown key is `422` with
   `code: "unknown_filter"`, an operator the field doesn't support or a malformed value is `422`
   with `code: "unsupported_filter"` or `"validation_failed"`, with `errors["filters.<key>"]`.
8. `q` is matched against server-chosen fields. It SHOULD follow rule 2 and MAY require a minimum
   length.

[`columnFilters()`](/modules/column-filters) offers these operators per column type: text columns
`contains`, `notContains`, `starts`, `ends`, `eq`, `ne`, `empty`, `notEmpty`; number and money
columns `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `between`, `empty`, `notEmpty`; dates `eq`, `gt`,
`lt`, `between`, `empty`, `notEmpty`; badges `in`, `notIn`.

## 9. Conformance

A **conforming client**:

- [ ] sends `v: 1` and a `page` with `size ≥ 1` and a 1-based `number`;
- [ ] sorts by field key and filters with the operators of [§8](#_8-filtering) only;
- [ ] omits empty filters and never sends client-only predicates;
- [ ] ignores unknown members in responses and errors;
- [ ] reads `count.mode` and `page.hasMore` from the response and pages without counts when needed;
- [ ] matches each response to the latest request it sent (abort or sequence numbers), not to
      `requestId`;
- [ ] renders values as text unless a column explicitly opts in to HTML;
- [ ] shows `title`/`errors` messages to users and keeps `detail` for developers;
- [ ] sends a CSRF header when the endpoint authenticates with cookies.

A **conforming server**:

- [ ] accepts `POST` with a JSON body (the GET form is optional);
- [ ] answers `400 unsupported_version` for any `v` other than `1`;
- [ ] ignores unknown request members and accepts requests without the OPTIONAL ones;
- [ ] whitelists sort keys, filter keys, operators and fields against its schema (`422` otherwise);
- [ ] enforces a maximum page size (`422` or clamp + warning);
- [ ] returns a stable, unique `id` on every row and no field outside its schema;
- [ ] orders deterministically, with a unique tiebreaker;
- [ ] returns accurate `page.hasMore` and states `count.mode` truthfully;
- [ ] answers past-the-end pages with `200` and empty `rows`;
- [ ] reports errors as `application/problem+json` with the right status, never as a redirect to HTML;
- [ ] keeps SQL, stack traces and personal data out of `title`.

## 10. Examples

The examples below come from the in-page demo server that also backs the demo at the top. Rows are
shortened where marked. Each body validates against the JSON Schemas.

### 10.1 First page, exact count

Request:

```http
POST /api/dgp/agents HTTP/1.1
Content-Type: application/json
Accept: application/json, application/problem+json
X-Requested-With: XMLHttpRequest
```

```json
{
  "v": 1,
  "page": { "size": 3, "number": 1 },
  "sort": [{ "key": "amount", "dir": "desc" }],
  "filters": { "status": { "op": "in", "value": ["open", "pending"] } },
  "fields": ["name", "unit", "status", "amount", "date"],
  "count": "exact",
  "requestId": "r-1"
}
```

Response (`200`, `application/json`):

```json
{
  "v": 1,
  "rows": [
    { "id": "1737", "name": "Cindy Lennox", "unit": "U.B.C.S.", "status": "pending", "amount": 19991.51, "date": "2026-06-16T21:40:00.000Z" },
    { "id": "1911", "name": "Sheva Alomar", "unit": "S.T.A.R.S. Bravo", "status": "pending", "amount": 19849.61, "date": "2026-08-02T02:40:00.000Z" },
    { "id": "1342", "name": "Ethan Winters", "unit": "S.T.A.R.S. Bravo", "status": "open", "amount": 19753.5, "date": "2025-10-07T13:40:00.000Z" }
  ],
  "page": { "size": 3, "number": 1, "hasMore": true },
  "count": { "mode": "exact", "total": 1000, "filtered": 375 },
  "meta": { "aggregates": { "amount": { "sum": 3094860.95 } }, "facets": {}, "warnings": [] }
}
```

### 10.2 Search, range filter, no count

Request:

```json
{
  "v": 1,
  "page": { "size": 2, "number": 4 },
  "sort": [{ "key": "date", "dir": "desc" }],
  "q": "kennedy",
  "filters": { "amount": { "op": "between", "value": [1000, 20000] } },
  "fields": ["name", "amount", "date"],
  "count": "none",
  "requestId": "r-7"
}
```

Response:

```json
{
  "v": 1,
  "rows": [
    { "id": "1686", "name": "Leon S. Kennedy", "amount": 17456.45, "date": "2026-06-30T15:40:00.000Z" },
    { "id": "1878", "name": "Leon S. Kennedy", "amount": 6111.1, "date": "2026-06-26T09:40:00.000Z" }
  ],
  "page": { "size": 2, "number": 4, "hasMore": true },
  "count": { "mode": "none" },
  "meta": { "aggregates": { "amount": { "sum": 422607.33 } }, "facets": {}, "warnings": [] }
}
```

### 10.3 The same as 10.1, GET form

```http
GET /api/dgp/agents?page%5Bsize%5D=3&page%5Bnumber%5D=1&sort=-amount&fields=name%2Cunit%2Cstatus%2Camount%2Cdate&count=exact&filter%5Bstatus%5D%5Bin%5D=open%2Cpending HTTP/1.1
Accept: application/json, application/problem+json
```

Decoded: `page[size]=3 & page[number]=1 & sort=-amount & fields=name,unit,status,amount,date &
count=exact & filter[status][in]=open,pending`. The response is the same as in 10.1.

### 10.4 Validation error

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
```

```json
{
  "type": "about:blank",
  "title": "Invalid filter",
  "status": 422,
  "code": "validation_failed",
  "retryable": false,
  "errors": { "filters.date": ["The date range is invalid."] }
}
```

The grid shows "The date range is invalid." without a Retry button.

### 10.5 Server error

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
```

```json
{
  "type": "about:blank",
  "title": "Server error",
  "status": 500,
  "detail": "SQLSTATE[42S22]: Column not found: 'unitt'",
  "code": "server_error",
  "retryable": true
}
```

The grid shows "The server returned an error (500)." with Retry. The `detail` text reaches only the
developer console (and a collapsed "Details" field while warnings are on), which is why it must never
be needed by end users.

## 11. Changelog

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-10-27 | First release: request, response, errors (RFC 9457), counting, sorting, 15 filter operators, GET form, JSON Schemas |

## Related

- [Server protocols overview](/protocol/): when to choose dgp over the SSP wire or Laravel's paginator.
- [Data sources](/guide/data-sources) and [Server protocols guide](/guide/server-protocols): attaching `serverSide({ protocol: dgp() })`.
- [columnFilters](/modules/column-filters): the header filter UI that produces typed filters.
- [States and errors](/guide/states-and-errors): how errors look in the grid.
