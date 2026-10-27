---
title: Messages (i18n keys)
type: reference
description: Every UI string key of the grid with its English and Turkish default, how to override them, and the message keys of each module.
---

# Messages

Every visible or announced string comes from a `Messages` object. The grid picks a pack by
locale (locales starting with `tr` get Turkish, all others English) and merges overrides over it:

```text
language pack  →  configure({ messages })  →  grid option messages
```

Keys you leave out, or set to `undefined`, keep the value from the layer below.

```js
import { configure, Datagrid } from "@akinozgen17/datagrids";

configure({ messages: { empty: "Nothing here yet" } });            // every grid created afterwards
new Datagrid("#agents", {
  label: "Agents",
  messages: { found: (n) => `${n} agents found`, records: "agents" }, // this grid only
  columns,
});
```

Function keys keep their signature. Numbers arrive **already formatted** for the grid's locale
(`"1,234"` / `"1.234"`), so a function only places them. Both packs are exported as `en` and `tr`
for starting a new language; see [Static API](/reference/static#en-tr) and
[Localization](/guide/i18n).

## Toolbar and states

| Key | English | Turkish |
|---|---|---|
| `search` | Search… | Ara… |
| `searchLabel` | Search | Ara |
| `clear` | Clear | Temizle |
| `loading` | Loading… | Yükleniyor… |
| `empty` | No records | Kayıt yok |
| `emptyText` | There is nothing to show yet. | Henüz gösterilecek kayıt yok. |
| `noMatch` | No matching records | Eşleşen kayıt bulunamadı |
| `noMatchText` | Try a different search term. | Farklı bir arama deneyin. |
| `clearSearch` | Clear search | Aramayı temizle |
| `error` | Couldn't load the list | Liste yüklenemedi |
| `errorText` | Something went wrong while loading. You can try again. | Yüklenirken bir sorun oluştu. Yeniden deneyebilirsiniz. |
| `retry` | Retry | Yeniden dene |
| `errorDetail` | Details | Ayrıntı |
| `manual` | List not loaded yet | Liste henüz yüklenmedi |
| `manualText` | Load the list when you need it. | Listeyi gerektiğinde yükleyin. |
| `load` | Load | Yükle |
| `records` | records | kayıt |

`search` is the placeholder, `searchLabel` the accessible name of the search box. `empty` /
`emptyText` show when there are no rows at all, `noMatch` / `noMatchText` when a search or filter
matches nothing. `manual*` and `load` belong to `load: "manual"`.

## Footer and pager

| Key | English (example output) | Turkish (example output) |
|---|---|---|
| `info(from, to, filtered, total)` | 51–75 / 340 records (total 1,234) | 51–75 / 340 kayıt (toplam 1.234) |
| `infoUnknown(from, to)` | 51–75 shown | 51–75 gösteriliyor |
| `totalUnknown` | total unknown | toplam bilinmiyor |
| `pageSize` | Per page | Sayfa başına |
| `page` | Page | Sayfa |
| `pageOf(total)` | of 14 | / 14 |
| `pagination` | Pagination | Sayfalama |
| `first` | First page | İlk sayfa |
| `prev` | Previous page | Önceki sayfa |
| `next` | Next page | Sonraki sayfa |
| `last` | Last page | Son sayfa |
| `all` | All | Tümü |

`info` gets `total = null` when nothing is filtered out (then the parenthesis is left out).
`infoUnknown` and `totalUnknown` are used when the server doesn't count. `pagination` names the
pager landmark (followed by the grid's label), `all` is the `-1` page size.

## Announcements and landmarks

| Key | English (example output) | Turkish (example output) |
|---|---|---|
| `skip` | Skip table | Tabloyu atla |
| `regionLabel` | Data table | Veri tablosu |
| `sortedAsc(col)` | Sorted by Name, ascending | Sıralama: Name, artan |
| `sortedDesc(col)` | Sorted by Name, descending | Sıralama: Name, azalan |
| `sortCleared` | Sorting cleared | Sıralama kaldırıldı |
| `found(n)` | 12 records found | 12 kayıt bulundu |
| `pageAnnounce(page, pages)` | Page 2 of 14 | Sayfa 2 / 14 |
| `openRow` | Open row | Satırı aç |

`skip` is the "skip table" link text; `regionLabel` the fallback name of an unnamed grid
([DG002](/errors/DG002)); `openRow` the hidden header of the `rowClick` chevron column.

## Errors

| Key | English | Turkish |
|---|---|---|
| `errNetwork` | The server could not be reached. Check your connection. | Sunucuya ulaşılamadı. Bağlantınızı kontrol edin. |
| `errTimeout` | The server took too long to respond. | Sunucu zamanında yanıt vermedi. |
| `errSession` | Your session has expired. Please sign in again. | Oturumunuz sona erdi. Lütfen yeniden giriş yapın. |
| `errForbidden` | You are not allowed to view this list. | Bu listeyi görüntüleme yetkiniz yok. |
| `errServer(status)` | The server returned an error (500). | Sunucu bir hata döndürdü (500). |
| `errParse` | The server response could not be read. | Sunucu yanıtı okunamadı. |

A server's own message (JSON `message`, a validation error) is shown instead of `errForbidden` and
`errServer` for 403, 410, 422 and 429 responses.

## Dialogs and actions

| Key | English | Turkish |
|---|---|---|
| `confirmTitle` | Are you sure? | Emin misiniz? |
| `confirmOk` | Confirm | Onayla |
| `confirmCancel` | Cancel | Vazgeç |
| `actionDone` | Done. | İşlem tamamlandı. |

Used by the built-in confirm dialog and `grid.action()` when the response has no `message`.

## Module messages

Modules keep their own strings. Each takes a `messages` option (partial, merged over its pack) and
picks Turkish or English by the grid's locale like the core.

```js
colVis({ messages: { button: "Fields" } });
excel({ messages: { excel: "Spreadsheet (.xlsx)" } });
```

### colVis

| Key | English |
|---|---|
| `button` | Columns |
| `legend` | Show / hide columns |
| `showAll` | Show all |
| `reset` | Reset to default |
| `search` | Find column… |
| `searchLabel` | Find column |
| `noMatch` | No matching columns |
| `locked` | This column can't be hidden |

### colReorder

| Key | English (example output) |
|---|---|
| `earlier(col)` | Move Name earlier |
| `later(col)` | Move Name later |
| `moved(col, pos, total)` | Name moved to position 2 of 6. |
| `hint` | Drag to move |

### columnFilters

| Key | English (example output) |
|---|---|
| `filter(col)` | Filter: Name |
| `apply` | Apply |
| `clear` | Clear |
| `clearAll` | Clear filters |
| `value` | Value |
| `and` | and |
| `active(n)` | 2 filters |
| `ops` | operator labels, see below |

`ops` maps every operator to its label: `eq` equals, `ne` not equal, `gt` greater than, `gte` at
least, `lt` less than, `lte` at most, `between` between, `in` is any of, `notIn` is none of,
`contains` contains, `notContains` does not contain, `starts` starts with, `ends` ends with, `empty`
is empty, `notEmpty` is not empty. Override the whole `ops` object when you change it.

### selection

| Key | English (example output) |
|---|---|
| `selected` | selected |
| `idle` | Select rows to enable actions |
| `selectAll(n)` | Select all 340 matching |
| `allSelected` | All matching records are selected. |
| `clear` | Clear selection |
| `hidden(n)` | 3 not shown |
| `row(label)` | Select: Jill Valentine |
| `page` | Select all on this page |
| `column` | Select |
| `bar` | Selection |
| `announce(n)` | 3 rows selected |
| `announceAll(n)` | All 340 matching rows selected |
| `cleared` | Selection cleared |
| `reset` | The filter changed; select-all was cleared |

### actions

| Key | English (example output) |
|---|---|
| `actions` | Actions |
| `more` | More actions |
| `forRow(label)` | Actions: Jill Valentine |

### excel, csv, print

The export modules share one menu and one message object.

| Key | English (example output) |
|---|---|
| `menu` | Export |
| `excel` | Excel (.xlsx) |
| `csv` | CSV |
| `print` | Print |
| `yes` | Yes |
| `no` | No |
| `records` | records |
| `done(n)` | 340 records exported |
| `failed` | Export failed |
| `truncated(n, total)` | Only the first 1,000 of 4,200 records were exported |

### button.reload, button.resetState

| Key | English |
|---|---|
| `reload` | Reload |
| `resetState` | Reset |
| `resetStateTitle` | Reset the view to its defaults |

`button.custom()` and `button.group()` take their text from `label`.

### softDeletes

| Key | English |
|---|---|
| `label` | Show deleted |

### footer

| Key | English |
|---|---|
| `page` | Page total |
| `total` | Total |

### responsive

| Key | English |
|---|---|
| `show` | Show hidden columns |
| `hide` | Hide hidden columns |

## Related

- [Localization & RTL](/guide/i18n) · [Grid options](/reference/options#localization) · [Static API](/reference/static)
