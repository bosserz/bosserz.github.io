import { gcjToWgs } from './coords';
import { CATEGORY_LABEL, type Place } from './places';
import { dateLabel, dayInfo } from './trip';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function amapUrl(p: Place): string {
  const [lng, lat] = p.gcj; // AMap URI API with coordinate=gaode expects GCJ-02.
  const q = new URLSearchParams({
    position: `${lng},${lat}`,
    name: p.name_zh,
    src: 'shanghai-trip',
    coordinate: 'gaode',
    callnative: '1',
  });
  return `https://uri.amap.com/marker?${q}`;
}

export function appleMapsUrl(p: Place): string {
  // Apple Maps resolves `q` (the Chinese name) against its own China data (AutoNavi),
  // and `ll` only biases that search. We send WGS-84 because Apple's public APIs take
  // WGS-84 and convert internally for China.
  // UNVERIFIED on device: if a pin lands ~500 m off on iPhone, switch this to p.gcj.
  const [lng, lat] = gcjToWgs(p.gcj);
  return `https://maps.apple.com/?q=${encodeURIComponent(p.name_zh)}&ll=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export class Sheet {
  private el = document.getElementById('sheet')!;
  private body = document.getElementById('sheet-body')!;
  current: Place | null = null;

  constructor(private onToggleVisited: (p: Place) => void) {
    document.getElementById('sheet-close')!.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }

  open(p: Place, distance?: string): void {
    this.current = p;
    this.body.innerHTML = `
      ${p.day ? `<p class="sheet__day" style="--day:${dayInfo(p.day)?.color ?? '#333'}">Day ${p.day} · ${dateLabel(p.day)}${p.time ? ` · ${p.time}` : ''}</p>` : ''}
      <p class="sheet__meta">${CATEGORY_LABEL[p.category]} · ${esc(p.subtype)}${distance ? ` · ${distance}` : ''}</p>
      <h2 class="sheet__title">${esc(p.name_en)}</h2>
      <p class="sheet__zh${p.name_zh.length > 9 ? ' sheet__zh--long' : ''}" lang="zh-CN">${esc(p.name_zh)}</p>
      ${p.address_zh ? `<p class="sheet__addr" lang="zh-CN">${esc(p.address_zh)}</p>` : ''}
      ${p.tip ? `<p class="sheet__tip">${esc(p.tip)}</p>` : ''}
      ${p.notes ? `<p class="sheet__notes">${esc(p.notes)}</p>` : ''}
      <div class="sheet__actions">
        <a class="btn btn--primary" href="${esc(amapUrl(p))}" target="_blank" rel="noopener">Navigate in Amap</a>
        <a class="btn" href="${esc(appleMapsUrl(p))}" target="_blank" rel="noopener">Apple Maps</a>
        <button class="btn" type="button" data-copy="${esc(p.name_zh)}">Copy Chinese name</button>
        ${p.address_zh ? `<button class="btn" type="button" data-copy="${esc(p.address_zh)}">Copy address</button>` : ''}
        <button class="btn${p.visited ? ' btn--on' : ''}" type="button" data-act="visited" aria-pressed="${p.visited}">
          ${p.visited ? '✓ Visited' : 'Mark visited'}
        </button>
      </div>`;
    this.body.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const label = btn.textContent;
        btn.textContent = (await copyText(btn.dataset.copy!)) ? 'Copied' : 'Copy failed';
        setTimeout(() => (btn.textContent = label), 1500);
      }),
    );
    this.body.querySelector('[data-act="visited"]')!.addEventListener('click', () => {
      p.visited = !p.visited;
      this.onToggleVisited(p);
      this.open(p, distance);
    });
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('sheet--open'));
  }

  close(): void {
    if (!this.current) return;
    this.current = null;
    this.el.classList.remove('sheet--open');
    setTimeout(() => {
      if (!this.current) this.el.hidden = true;
    }, 220);
  }
}
