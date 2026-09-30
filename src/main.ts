import './base.css';
import './style.css';
import { h, toast, uid, langToggle, confirmDialog, showSaveBanner, hideSaveBanner } from './ui';
import { dicts, type Lang, type Dict } from './i18n';
import { askPersist, idbLoad, idbSave, idbPutNow } from './db';

const DB = 'kaimono-memo';
const AISLES = ['', 'veg', 'meat', 'fish', 'dairy', 'season', 'other'] as const;
type Aisle = (typeof AISLES)[number];

interface Item { id: string; text: string; qty: string; aisle: Aisle; done: boolean }
interface ShopList { id: string; name: string; items: Item[] }
interface State { lang: Lang; lists: ShopList[]; activeId: string; draftAisle: Aisle }

let state: State = { lang: 'ja', lists: [], activeId: '', draftAisle: '' };
let t: Dict = dicts.ja;
let draftName = '';
let draftQty = '';
const app = document.getElementById('app')!;

function isLang(v: unknown): v is Lang { return v === 'ja' || v === 'en'; }
function isAisle(v: unknown): v is Aisle { return typeof v === 'string' && (AISLES as readonly string[]).includes(v); }
function blankList(name: string): ShopList { return { id: uid(), name, items: [] }; }
function normalize(raw: unknown): State {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const lists: ShopList[] = [];
  if (Array.isArray(o.lists)) {
    for (const item of o.lists) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      if (typeof r.id !== 'string') continue;
      const items: Item[] = [];
      if (Array.isArray(r.items)) {
        for (const it of r.items) {
          if (!it || typeof it !== 'object') continue;
          const ir = it as Record<string, unknown>;
          if (typeof ir.id !== 'string') continue;
          items.push({
            id: ir.id,
            text: typeof ir.text === 'string' ? ir.text : '',
            qty: typeof ir.qty === 'string' ? ir.qty : '',
            aisle: isAisle(ir.aisle) ? ir.aisle : '',
            done: ir.done === true,
          });
        }
      }
      lists.push({ id: r.id, name: typeof r.name === 'string' ? r.name : '', items });
    }
  }
  const lang = isLang(o.lang) ? o.lang : 'ja';
  if (!lists.length) lists.push(blankList(lang === 'ja' ? '買い物' : 'Shopping'));
  const activeId = lists.some((l) => l.id === o.activeId) ? String(o.activeId) : lists[0].id;
  return { lang, lists, activeId, draftAisle: isAisle(o.draftAisle) ? o.draftAisle : '' };
}

let saveChain: Promise<void> = Promise.resolve();
let saveQueued = false;
function queueSave(): void {
  saveQueued = true;
  saveChain = saveChain.then(async () => {
    if (!saveQueued) return;
    saveQueued = false;
    try {
      await idbSave(DB, state);
      hideSaveBanner();
    } catch {
      showSaveBanner();
    }
  }).catch(() => { showSaveBanner(); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) queueSave(); });
window.addEventListener('pagehide', () => { idbPutNow(DB, state); queueSave(); });

function setLang(l: Lang): void {
  state.lang = l;
  t = dicts[l];
  document.documentElement.lang = l;
  document.title = t.app;
  queueSave();
  render();
}
function active(): ShopList {
  return state.lists.find((l) => l.id === state.activeId) ?? state.lists[0];
}
function aisleName(a: Aisle): string {
  if (a === 'veg') return t.veg;
  if (a === 'meat') return t.meat;
  if (a === 'fish') return t.fish;
  if (a === 'dairy') return t.dairy;
  if (a === 'season') return t.season;
  if (a === 'other') return t.other;
  return t.none;
}
function nextAisle(a: Aisle): Aisle {
  const i = AISLES.indexOf(a);
  return AISLES[(i + 1) % AISLES.length] ?? '';
}

function addItem(): void {
  const text = draftName.trim();
  const qty = draftQty.trim();
  if (!text && !qty) return;
  active().items.push({ id: uid(), text, qty, aisle: state.draftAisle, done: false });
  draftName = '';
  draftQty = '';
  queueSave();
  render();
  document.getElementById('add-name')?.focus();
}
function move(item: Item, dir: -1 | 1): void {
  const items = active().items;
  const i = items.indexOf(item);
  const j = i + dir;
  const a = items[i];
  const b = items[j];
  if (!a || !b) return;
  items[i] = b;
  items[j] = a;
  queueSave();
  render();
}
function clearChecked(): void {
  const list = active();
  if (!list.items.some((i) => i.done)) return;
  const snapshot = list.items.slice();
  list.items = list.items.filter((i) => !i.done);
  queueSave();
  render();
  toast(t.cleared, {
    label: t.undo,
    run: () => {
      list.items = snapshot;
      queueSave();
      render();
    },
  });
}
function addList(): void {
  const n = state.lists.length + 1;
  const list = blankList(state.lang === 'ja' ? `リスト${n}` : `List ${n}`);
  state.lists.push(list);
  state.activeId = list.id;
  queueSave();
  render();
}
async function deleteList(id: string): Promise<void> {
  const ok = await confirmDialog(t.deleteAsk, t.deleteBody, t.delList, t.cancel, true);
  if (!ok) return;
  state.lists = state.lists.filter((l) => l.id !== id);
  if (!state.lists.length) {
    const list = blankList(state.lang === 'ja' ? '買い物' : 'Shopping');
    state.lists.push(list);
    state.activeId = list.id;
  } else if (!state.lists.some((l) => l.id === state.activeId)) {
    state.activeId = state.lists[0].id;
  }
  queueSave();
  render();
}

function render(): void {
  const list = active();
  const left = list.items.filter((i) => !i.done).length;
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('h1', {}, t.app),
      langToggle(state.lang, setLang),
    ),
    h('main', {},
      h('p', { class: 'subhead' }, t.sub),
      h('div', { class: 'lists', role: 'tablist' },
        ...state.lists.map((l) => h('button', {
          class: 'btn' + (l.id === list.id ? ' primary' : ''),
          type: 'button',
          role: 'tab',
          'aria-selected': String(l.id === list.id),
          onclick: () => { state.activeId = l.id; queueSave(); render(); },
        }, l.name.trim() || t.listPh)),
        h('button', { class: 'btn', type: 'button', onclick: addList }, '+'),
      ),
      h('label', { class: 'field' }, t.listPh,
        h('input', {
          class: 'input', type: 'text', value: list.name, placeholder: t.listPh, autocomplete: 'off',
          oninput: (e: Event) => { list.name = (e.target as HTMLInputElement).value; queueSave(); },
        }),
      ),
      h('div', { class: 'row' },
        h('input', {
          id: 'add-name', class: 'input grow', type: 'text', value: draftName, placeholder: t.addPh,
          autocomplete: 'off', 'aria-label': t.addPh,
          oninput: (e: Event) => { draftName = (e.target as HTMLInputElement).value; },
          onkeydown: (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); addItem(); }
          },
        }),
        h('input', {
          class: 'input qty', type: 'text', inputmode: 'text', value: draftQty, placeholder: t.qtyPh,
          autocomplete: 'off', 'aria-label': t.qtyPh,
          oninput: (e: Event) => { draftQty = (e.target as HTMLInputElement).value; },
          onkeydown: (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); addItem(); }
          },
        }),
        h('button', { class: 'btn primary', type: 'button', onclick: addItem }, t.add),
      ),
      h('div', { class: 'chips', role: 'group', 'aria-label': t.aisleLabel },
        ...AISLES.map((a) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(state.draftAisle === a),
          onclick: () => { state.draftAisle = a; queueSave(); render(); },
        }, aisleName(a))),
      ),
      h('div', { class: 'row' },
        h('span', { class: 'muted small grow' }, t.left(left)),
        h('button', {
          class: 'btn', type: 'button',
          disabled: list.items.some((i) => i.done) ? undefined : '',
          onclick: clearChecked,
        }, t.clear),
      ),
      list.items.length === 0
        ? h('p', { class: 'empty' }, t.empty)
        : h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
            ...list.items.map((item, index) => itemRow(item, index, list.items.length)),
          ),
      state.lists.length > 1
        ? h('button', { class: 'btn danger block', type: 'button', onclick: () => { void deleteList(list.id); } }, t.delList)
        : null,
    ),
    h('p', { class: 'foot' }, t.privacy),
  );
}

function itemRow(item: Item, index: number, total: number): HTMLElement {
  return h('article', { class: 'card item' },
    h('button', {
      class: 'check', type: 'button',
      'aria-pressed': String(item.done),
      'aria-label': item.done ? t.uncheck : t.check,
      onclick: () => { item.done = !item.done; queueSave(); render(); },
    }, '✓'),
    h('div', { class: 'item-body' },
      h('input', {
        class: 'input' + (item.done ? ' name-done' : ''),
        type: 'text', value: item.text, placeholder: t.addPh, autocomplete: 'off', 'aria-label': t.addPh,
        oninput: (e: Event) => { item.text = (e.target as HTMLInputElement).value; queueSave(); },
      }),
      h('div', { class: 'row' },
        h('input', {
          class: 'input qty', type: 'text', value: item.qty, placeholder: t.qtyPh, autocomplete: 'off', 'aria-label': t.qtyPh,
          oninput: (e: Event) => { item.qty = (e.target as HTMLInputElement).value; queueSave(); },
        }),
        h('button', {
          type: 'button', class: 'chip', 'aria-label': t.aisleLabel,
          onclick: () => { item.aisle = nextAisle(item.aisle); queueSave(); render(); },
        }, aisleName(item.aisle)),
        h('span', { class: 'grow' }),
        h('button', {
          class: 'mini', type: 'button', 'aria-label': t.up, disabled: index === 0 ? '' : undefined,
          onclick: () => move(item, -1),
        }, '↑'),
        h('button', {
          class: 'mini', type: 'button', 'aria-label': t.down, disabled: index === total - 1 ? '' : undefined,
          onclick: () => move(item, 1),
        }, '↓'),
      ),
    ),
  );
}

async function boot(): Promise<void> {
  await askPersist();
  try { state = normalize(await idbLoad(DB)); }
  catch {
    state = normalize({});
    showSaveBanner();
  }
  t = dicts[state.lang];
  document.documentElement.lang = state.lang;
  document.title = t.app;
  render();
  queueSave();
}
void boot();
