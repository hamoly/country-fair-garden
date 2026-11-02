// The 2D layer over the garden: turn plaque, order tag, seed-packet hand, almanac,
// prompts, tooltips and the start / end sheets.

import { CROPS, GARDEN_KIT, copiesInDeck, DECK, type Card, type CardId, type CropType } from '../game/config';
import { LOSE_MESSAGE, WIN_MESSAGE, type NewsLine, type TurnReport } from '../game/engine';
import { ICONS, rosette } from './icons';

export interface HudHandlers {
  onBegin(): void;
  onCard(index: number): void;
  onCancel(): void;
  onRestart(): void;
}

export interface TooltipContent {
  title: string;
  lines: string[];
  note?: string;
  action?: { text: string; tone: 'ok' | 'warn' };
}

const CROP_LABEL: Record<CropType, [singular: string, plural: string]> = {
  carrot: ['Carrot', 'Carrots'],
  tomato: ['Tomato', 'Tomatoes'],
  pumpkin: ['Pumpkin', 'Pumpkins'],
};

const CARD_STYLE: Record<CardId, { ink: string; kind: string }> = {
  carrot: { ink: '#b8561c', kind: 'Seeds' },
  tomato: { ink: '#a8321f', kind: 'Seeds' },
  pumpkin: { ink: '#b5630f', kind: 'Seeds' },
  water: { ink: '#2d6fa8', kind: 'Chore' },
  rain: { ink: '#4b6886', kind: 'Weather' },
  compost: { ink: '#74491f', kind: 'Chore' },
  summer: { ink: '#a87a06', kind: 'Weather' },
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Title and detail for a card, from its name in the original program. */
function cardText(card: Card): { title: string; detail: string } {
  if (card.action === 'plant' && card.crop) {
    return { title: card.name, detail: `Ready to pick after ${GARDEN_KIT.grow[card.crop]} stages` };
  }
  const [title, detail = ''] = card.name.split(': ');
  return { title, detail: capitalise(detail) };
}

const el = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string) => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Hud {
  private handlers: HudHandlers | null = null;
  private readonly topbar: HTMLElement;
  private readonly hand: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly tooltip: HTMLElement;
  private readonly almanacList: HTMLElement;
  private readonly almanac: HTMLElement;
  private readonly intro: HTMLElement;
  private readonly ending: HTMLElement;
  private toastTimer = 0;
  private turnsShown = 0;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = this.template();
    this.topbar = el(root, '[data-topbar]');
    this.hand = el(root, '[data-hand]');
    this.prompt = el(root, '[data-prompt]');
    this.toastEl = el(root, '[data-toast]');
    this.tooltip = el(root, '[data-tooltip]');
    this.almanacList = el(root, '[data-almanac-list]');
    this.almanac = el(root, '[data-almanac]');
    this.intro = el(root, '[data-intro]');
    this.ending = el(root, '[data-ending]');

    el(root, '[data-begin]').addEventListener('click', () => this.handlers?.onBegin());
    el(root, '[data-restart]').addEventListener('click', () => this.handlers?.onRestart());
    el(root, '[data-cancel]').addEventListener('click', () => this.handlers?.onCancel());
    this.hand.addEventListener('click', (event) => {
      const packet = (event.target as HTMLElement).closest<HTMLButtonElement>('.packet');
      if (packet && !packet.disabled) this.handlers?.onCard(Number(packet.dataset.index));
    });
    const toggle = el<HTMLButtonElement>(root, '[data-almanac-toggle]');
    toggle.addEventListener('click', () => {
      const open = !this.almanac.classList.contains('is-open');
      this.almanac.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  bind(handlers: HudHandlers): void {
    this.handlers = handlers;
  }

  /** Pixels hidden behind the top bar and the cards. */
  insets(): { top: number; bottom: number } {
    const top = this.topbar.getBoundingClientRect().bottom;
    const bottom = window.innerHeight - this.hand.getBoundingClientRect().top + 8;
    return { top: Math.max(0, top), bottom: Math.max(0, bottom) };
  }

  get introVisible(): boolean {
    return !this.intro.hidden;
  }

  get endingVisible(): boolean {
    return !this.ending.hidden;
  }

  hideIntro(): void {
    this.intro.hidden = true;
  }

  focusBegin(): void {
    el<HTMLButtonElement>(this.root, '[data-begin]').focus();
  }

  // ---- Turn plaque and order tag --------------------------------------------------

  setTurn(turn: number, turns: number): void {
    el(this.root, '[data-turn]').textContent = String(Math.min(turn, turns));
    el(this.root, '[data-turns]').textContent = String(turns);
    const pips = el(this.root, '[data-pips]');
    const added = turns > this.turnsShown && this.turnsShown > 0;
    pips.innerHTML = Array.from({ length: turns }, (_, i) => {
      const state = i + 1 < turn ? 'done' : i + 1 === turn ? 'now' : 'left';
      const fresh = added && i >= this.turnsShown ? ' is-new' : '';
      return `<li class="pip pip-${state}${fresh}"></li>`;
    }).join('');
    this.turnsShown = turns;
    el(this.root, '[data-plaque]').setAttribute('aria-label', `Turn ${Math.min(turn, turns)} of ${turns}`);
  }

  setOrder(harvest: Record<CropType, number>): void {
    for (const crop of CROPS) this.setOrderRow(crop, harvest[crop]);
  }

  private setOrderRow(crop: CropType, have: number): void {
    const need = GARDEN_KIT.order[crop];
    const row = el(this.root, `[data-order-crop="${crop}"]`);
    el(row, '[data-have]').textContent = String(have);
    el(row, '[data-pipset]').innerHTML = Array.from({ length: need }, (_, i) =>
      `<i class="${i < have ? 'is-full' : ''}"></i>`,
    ).join('');
    row.classList.toggle('is-filled', have >= need);
    row.setAttribute('aria-label', `${CROP_LABEL[crop][1]}: ${have} of ${need}`);
  }

  /** Fly a crop icon from a screen point into the order tag, then update that row. */
  async flyToOrder(crop: CropType, from: { x: number; y: number }, have: number): Promise<void> {
    const row = el(this.root, `[data-order-crop="${crop}"]`);
    const target = el(row, '.tag-icon').getBoundingClientRect();
    const flyer = document.createElement('div');
    flyer.className = 'flyer';
    flyer.innerHTML = ICONS[crop];
    flyer.style.left = `${from.x - 20}px`;
    flyer.style.top = `${from.y - 20}px`;
    this.root.appendChild(flyer);
    const dx = target.left + target.width / 2 - from.x;
    const dy = target.top + target.height / 2 - from.y;
    const animation = flyer.animate(
      [
        { transform: 'translate(0, 0) scale(0.6)', opacity: 0.4 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 70}px) scale(1.35)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 1 },
      ],
      { duration: reducedMotion ? 250 : 850, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' },
    );
    await animation.finished.catch(() => undefined);
    flyer.remove();
    this.setOrderRow(crop, have);
    row.classList.remove('is-bumped');
    void row.offsetWidth; // restart the CSS animation
    row.classList.add('is-bumped');
  }

  // ---- Hand ------------------------------------------------------------------------

  renderHand(cards: Card[]): void {
    this.hand.innerHTML = cards
      .map((card, i) => {
        const { title, detail } = cardText(card);
        const style = CARD_STYLE[card.id];
        const odds = `${copiesInDeck(card.id)} of ${DECK.length} in the deck`;
        return `
          <button class="packet" type="button" data-index="${i}" style="--card:${style.ink}; --i:${i}"
            aria-label="${i + 1}. ${card.name}">
            <span class="packet-head"><span class="packet-key">${i + 1}</span><span class="packet-kind">${style.kind}</span></span>
            <span class="packet-art">${ICONS[card.id]}</span>
            <span class="packet-title">${title}</span>
            <span class="packet-detail">${detail}</span>
            <span class="packet-odds">${odds}</span>
          </button>`;
      })
      .join('');
    this.setHandEnabled(true);
  }

  setHandEnabled(enabled: boolean): void {
    this.hand.classList.toggle('is-busy', !enabled);
    this.hand.querySelectorAll<HTMLButtonElement>('.packet').forEach((p) => (p.disabled = !enabled));
  }

  /** Lift one card (or none), dim the rest while a target is chosen. */
  selectCard(index: number | null): void {
    this.hand.classList.toggle('has-selection', index !== null);
    this.hand.querySelectorAll<HTMLButtonElement>('.packet').forEach((p) => {
      const on = Number(p.dataset.index) === index;
      p.classList.toggle('is-selected', on);
      p.setAttribute('aria-pressed', String(on));
    });
  }

  setPrompt(text: string | null, icon?: CardId): void {
    this.prompt.hidden = text === null;
    if (text === null) return;
    el(this.prompt, '[data-prompt-text]').textContent = text;
    el(this.prompt, '[data-prompt-icon]').innerHTML = icon ? ICONS[icon] : '';
  }

  // ---- Messages --------------------------------------------------------------------

  toast(text: string, tone: 'info' | 'warn' | 'rabbit' = 'info', icon?: NewsLine['icon']): void {
    window.clearTimeout(this.toastTimer);
    this.toastEl.className = `toast toast-${tone}`;
    this.toastEl.innerHTML = `${icon ? `<span class="toast-icon">${ICONS[icon]}</span>` : ''}<span></span>`;
    (this.toastEl.lastElementChild as HTMLElement).textContent = text;
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('is-shown');
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('is-shown'), 3200);
  }

  showTooltip(x: number, y: number, content: TooltipContent): void {
    const t = this.tooltip;
    t.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = content.title;
    t.appendChild(title);
    for (const line of content.lines) {
      const p = document.createElement('span');
      p.textContent = line;
      t.appendChild(p);
    }
    if (content.note) {
      const note = document.createElement('span');
      note.className = 'tooltip-note';
      note.textContent = content.note;
      t.appendChild(note);
    }
    if (content.action) {
      const action = document.createElement('span');
      action.className = `tooltip-action is-${content.action.tone}`;
      action.textContent = content.action.text;
      t.appendChild(action);
    }
    t.hidden = false;
    // Keep it on screen.
    const rect = t.getBoundingClientRect();
    const left = Math.min(x + 16, window.innerWidth - rect.width - 12);
    const top = y + 18 + rect.height > window.innerHeight - 12 ? y - rect.height - 14 : y + 18;
    t.style.left = `${Math.max(12, left)}px`;
    t.style.top = `${Math.max(12, top)}px`;
  }

  hideTooltip(): void {
    this.tooltip.hidden = true;
  }

  // ---- Almanac ---------------------------------------------------------------------

  addAlmanac(report: TurnReport): void {
    this.almanacList.querySelector('.almanac-empty')?.remove();
    const entry = document.createElement('li');
    entry.className = 'entry';
    const line = (news: NewsLine, extra = '') => {
      const p = document.createElement('p');
      p.className = `entry-line ${extra}`;
      p.innerHTML = `<span class="ico">${ICONS[news.icon]}</span><span></span>`;
      (p.lastElementChild as HTMLElement).textContent = news.text;
      return p;
    };
    const heading = document.createElement('h3');
    heading.className = 'entry-turn';
    heading.textContent = `Turn ${report.turn}`;
    entry.append(heading, line(report.action));
    if (report.growthNews) {
      entry.append(line(report.growthNews, 'is-quiet'));
      const list = document.createElement('ul');
      list.className = 'entry-growth';
      for (const g of report.growth) {
        const li = document.createElement('li');
        const start = g.start === null ? 'new' : `${g.start}/${g.needs}`;
        const end = g.harvested ? '<b>harvested!</b>' : `${g.to}/${g.needs}`;
        li.innerHTML = `<span class="ico sm">${ICONS[g.crop]}</span><span>Row ${g.row + 1}, column ${g.col + 1}: ${start} → ${end}</span>`;
        list.appendChild(li);
      }
      entry.appendChild(list);
    }
    if (report.rabbit) entry.append(line(report.rabbit.news, 'is-rabbit'));
    this.almanacList.prepend(entry);
  }

  clearAlmanac(): void {
    this.almanacList.innerHTML = `<li class="almanac-empty">Each turn's news is written here.</li>`;
  }

  // ---- Ending ----------------------------------------------------------------------

  showEnding(won: boolean, turn: number, turns: number, harvest: Record<CropType, number>): void {
    el(this.ending, '[data-ending-art]').innerHTML = rosette(won ? 'first' : 'participant');
    el(this.ending, '[data-ending-title]').textContent = won ? 'Blue ribbon!' : 'Not ready for judging';
    el(this.ending, '[data-ending-text]').textContent = won ? WIN_MESSAGE : LOSE_MESSAGE;
    el(this.ending, '[data-ending-when]').textContent = won
      ? `Order filled on turn ${turn} of ${turns}.`
      : `The season ended after ${turns} turns.`;
    el(this.ending, '[data-ending-tally]').innerHTML = CROPS.map((crop) => {
      const need = GARDEN_KIT.order[crop];
      const ok = harvest[crop] >= need;
      return `<li class="${ok ? 'is-met' : 'is-short'}"><span class="ico">${ICONS[crop]}</span>${CROP_LABEL[crop][1]}<b>${harvest[crop]} / ${need}</b></li>`;
    }).join('');
    this.ending.classList.toggle('is-win', won);
    this.ending.hidden = false;
    el<HTMLButtonElement>(this.ending, '[data-restart]').focus();
  }

  hideEnding(): void {
    this.ending.hidden = true;
  }

  // ---- Markup ----------------------------------------------------------------------

  private template(): string {
    const { soil, grow, order, rules } = GARDEN_KIT;
    const orderRows = CROPS.map(
      (crop) => `
        <li class="tag-row" data-order-crop="${crop}">
          <span class="tag-icon">${ICONS[crop]}</span>
          <span class="tag-name">${CROP_LABEL[crop][1]}</span>
          <span class="tag-pips" data-pipset></span>
          <span class="tag-count"><b data-have>0</b>/${order[crop]}</span>
        </li>`,
    ).join('');
    const orderText = CROPS.map((c) => `<b>${order[c]} ${order[c] === 1 ? CROP_LABEL[c][0].toLowerCase() : CROP_LABEL[c][1].toLowerCase()}</b>`);

    return `
      <header class="topbar" data-topbar>
        <section class="plaque" data-plaque aria-live="polite">
          <span class="eyebrow">Turn</span>
          <span class="plaque-count"><strong data-turn>1</strong><span class="plaque-of">of <span data-turns>${rules.turns}</span></span></span>
          <ol class="turn-pips" data-pips aria-hidden="true"></ol>
        </section>
        <section class="tag" aria-label="Fair order">
          <span class="tag-hole" aria-hidden="true"></span>
          <h2 class="tag-title">Fair order</h2>
          <ul class="tag-list">${orderRows}</ul>
        </section>
      </header>

      <aside class="almanac" data-almanac>
        <button class="almanac-toggle" type="button" aria-expanded="false" data-almanac-toggle>Almanac</button>
        <div class="almanac-sheet">
          <h2 class="almanac-title">Almanac</h2>
          <ol class="almanac-list" data-almanac-list>
            <li class="almanac-empty">Each turn's news is written here.</li>
          </ol>
        </div>
      </aside>

      <div class="legend" aria-label="Map key">
        <span><i class="sw sw-plain"></i>Plain +${soil.plain.growth}</span>
        <span><i class="sw sw-rich"></i>Rich +${soil.rich.growth}</span>
        <span><i class="sw sw-stone"></i>Stone +${soil.stone.growth}</span>
        <span><span class="legend-icon">${ICONS.rabbit}</span>Rabbits raid the edges</span>
      </div>

      <div class="toast" data-toast role="status" aria-live="polite"></div>

      <footer class="dock" data-dock>
        <div class="prompt" data-prompt hidden>
          <span class="prompt-icon" data-prompt-icon></span>
          <span class="prompt-text" data-prompt-text></span>
          <button type="button" class="prompt-cancel" data-cancel>Choose again <kbd>Esc</kbd></button>
        </div>
        <div class="hand" data-hand role="group" aria-label="Your hand: pick one card"></div>
      </footer>

      <div class="tooltip" data-tooltip hidden></div>

      <div class="overlay" data-intro>
        <article class="sheet intro" aria-labelledby="intro-title">
          <p class="eyebrow">County fair · Vegetable division</p>
          <h1 class="title" id="intro-title">County Fair Garden</h1>
          <p class="lede">The fair wants ${orderText[0]}, ${orderText[1]} and ${orderText[2]}.
            You have <b>${rules.turns} turns</b> to grow them.</p>
          <div class="rules">
            <section>
              <h2>Each turn</h2>
              <p>You're dealt ${rules.handSize} different cards. Pick one: plant a seed, water a row, call the rain, spread compost, or stretch the summer.</p>
            </section>
            <section>
              <h2>Soil</h2>
              <ul class="key">
                <li><i class="sw sw-plain"></i>Plain soil<b>+${soil.plain.growth} stage</b></li>
                <li><i class="sw sw-rich"></i>Rich soil<b>+${soil.rich.growth} stages</b></li>
                <li><i class="sw sw-stone"></i>Stone<b>nothing grows</b></li>
              </ul>
              <p class="small">Every crop grows at the end of every turn.</p>
            </section>
            <section>
              <h2>Harvest</h2>
              <ul class="key">
                ${CROPS.map((c) => `<li><span class="ico">${ICONS[c]}</span>${CROP_LABEL[c][0]}<b>${grow[c]} stages</b></li>`).join('')}
              </ul>
              <p class="small">A crop is picked as soon as it's fully grown.</p>
            </section>
            <section>
              <h2>Rabbits</h2>
              <p>About one turn in three, a rabbit raids the garden. It eats a crop on an edge plot, but can't reach the middle four.</p>
            </section>
          </div>
          <div class="intro-actions">
            <button class="btn" type="button" data-begin>Start planting</button>
            <span class="hint">Press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to pick cards, arrow keys to pick plots.</span>
          </div>
        </article>
      </div>

      <div class="overlay" data-ending hidden>
        <article class="sheet ending" aria-labelledby="ending-title" aria-live="polite">
          <div class="ending-art" data-ending-art></div>
          <div class="ending-body">
            <h2 class="ending-title" id="ending-title" data-ending-title></h2>
            <p class="ending-text" data-ending-text></p>
            <p class="ending-when" data-ending-when></p>
            <ul class="ending-tally" data-ending-tally></ul>
            <button class="btn" type="button" data-restart>Plant again</button>
          </div>
        </article>
      </div>`;
  }
}
