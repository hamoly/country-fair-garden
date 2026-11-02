// Connects player input, the rules engine, the 3D garden and the HUD.

import { GARDEN_KIT, type Card, type CropType } from './game/config';
import { Game, type Cell, type PlayOutcome, type Target } from './game/engine';
import type { GardenView, StageChange } from './scene/garden-view';
import type { Stage } from './scene/stage';
import { wait } from './scene/tween';
import type { Hud, TooltipContent } from './ui/hud';

type Mode =
  | { kind: 'intro' }
  | { kind: 'choosing' }
  | { kind: 'targeting'; index: number; card: Card }
  | { kind: 'busy' }
  | { kind: 'over' };

const SOIL_LINE = {
  plain: `Plain soil · +${GARDEN_KIT.soil.plain.growth} stage a turn`,
  rich: `Rich soil · +${GARDEN_KIT.soil.rich.growth} stages a turn`,
  stone: 'Stone · nothing grows here',
} as const;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class Controller {
  private game = new Game();
  private mode: Mode = { kind: 'intro' };
  private hover: Cell | null = null;
  /** Keyboard-chosen plot while targeting; overrides the mouse until the mouse moves. */
  private cursor: Cell | null = null;
  private pointer = { x: 0, y: 0 };
  private touch = false;

  constructor(
    private readonly stage: Stage,
    private readonly view: GardenView,
    private readonly hud: Hud,
  ) {
    hud.bind({
      onBegin: () => this.begin(),
      onCard: (index) => this.chooseCard(index),
      onCancel: () => this.cancelTarget(),
      onRestart: () => this.restart(),
    });

    const canvas = stage.renderer.domElement;
    canvas.addEventListener('pointermove', (e: PointerEvent) => this.onPointerMove(e));
    canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.refreshHover();
    });
    canvas.addEventListener('pointerup', (e: PointerEvent) => this.onPointerUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.syncInsets());

    hud.setTurn(this.game.turn, this.game.turns);
    hud.setOrder(this.game.harvest);
    // Deal the first hand behind the start sheet, so the layout doesn't jump on "Start planting".
    hud.renderHand(this.game.hand);
    hud.setHandEnabled(false);
    this.syncInsets();
    hud.focusBegin();
  }

  // ---- Flow -----------------------------------------------------------------------

  private begin(): void {
    if (this.mode.kind !== 'intro') return;
    this.hud.hideIntro();
    this.startTurn();
  }

  private restart(): void {
    this.game = new Game();
    this.view.reset();
    this.hud.hideEnding();
    this.hud.clearAlmanac();
    this.hud.setOrder(this.game.harvest);
    this.startTurn();
  }

  private startTurn(): void {
    this.mode = { kind: 'choosing' };
    this.cursor = null;
    this.hud.setTurn(this.game.turn, this.game.turns);
    this.hud.renderHand(this.game.hand);
    this.hud.selectCard(null);
    this.hud.setPrompt(null);
    this.syncInsets();
    this.refreshHover();
  }

  private chooseCard(index: number): void {
    if (this.mode.kind !== 'choosing' && this.mode.kind !== 'targeting') return;
    const card = this.game.hand[index];
    if (!card) return;
    if (this.mode.kind === 'targeting' && this.mode.index === index) {
      this.cancelTarget();
      return;
    }
    if (card.action === 'plant' || card.action === 'water' || card.action === 'compost') {
      this.mode = { kind: 'targeting', index, card };
      this.hud.selectCard(index);
      this.hud.setPrompt(this.promptFor(card), card.id);
      this.syncInsets();
      this.refreshHover();
      return;
    }
    void this.attempt(index);
  }

  private cancelTarget(): void {
    if (this.mode.kind !== 'targeting') return;
    this.mode = { kind: 'choosing' };
    this.cursor = null;
    this.hud.selectCard(null);
    this.hud.setPrompt(null);
    this.syncInsets();
    this.refreshHover();
  }

  private async attempt(index: number, target?: Target): Promise<void> {
    const outcome = this.game.play(index, target);
    if (outcome.kind === 'retry') {
      // Same as the console version going back to "Your choice": nothing is used up.
      this.hud.toast(outcome.message, 'warn');
      return;
    }
    await this.playOut(index, outcome);
  }

  /** Animate the card, then the end of the turn, then deal the next hand. */
  private async playOut(index: number, outcome: Extract<PlayOutcome, { kind: 'done' }>): Promise<void> {
    this.mode = { kind: 'busy' };
    this.cursor = null;
    this.hud.selectCard(index);
    this.hud.setHandEnabled(false);
    this.hud.setPrompt(null);
    this.hud.hideTooltip();
    this.view.highlight([]);
    this.hud.toast(outcome.news.text, outcome.effect.type === 'wasted' ? 'warn' : 'info', outcome.news.icon);

    const effect = outcome.effect;
    switch (effect.type) {
      case 'plant':
        await this.view.plant(effect.cell, effect.crop, GARDEN_KIT.grow[effect.crop]);
        break;
      case 'wasted':
        await this.view.wasted(effect.cell);
        break;
      case 'water':
        await this.view.water(effect.row, this.stageChanges(effect.grown));
        break;
      case 'rain':
        await this.view.rain(this.stageChanges(effect.grown));
        break;
      case 'compost':
        await this.view.compost(this.stageChanges([effect.cell])[0]);
        break;
      case 'summer':
        this.hud.setTurn(this.game.turn, this.game.turns);
        await this.view.summer();
        break;
    }

    // End of turn: growth, harvest, rabbit (mystery.js lines 204–258).
    const harvestBefore = { ...this.game.harvest };
    const report = this.game.endTurn();
    await wait(200);
    await this.view.grow(report.growth);

    const counts = { ...harvestBefore };
    const picked = report.growth.filter((g) => g.harvested);
    await Promise.all(
      picked.map(async (g, i) => {
        await wait(i * 260);
        const from = await this.view.harvest(g);
        counts[g.crop] += 1;
        await this.hud.flyToOrder(g.crop, from, counts[g.crop]);
      }),
    );

    if (report.rabbit) {
      this.hud.toast(report.rabbit.news.text, 'rabbit', 'rabbit');
      await this.view.rabbitRaid(report.rabbit);
    }

    this.hud.addAlmanac(report);
    this.hud.setOrder(report.harvest);

    if (report.over) {
      this.mode = { kind: 'over' };
      this.hud.setHandEnabled(false);
      await wait(500);
      this.hud.showEnding(report.won, report.turn, this.game.turns, report.harvest);
      return;
    }
    this.startTurn();
  }

  private stageChanges(cells: Cell[]): StageChange[] {
    return cells.flatMap((cell) => {
      const plot = this.game.plotAt(cell);
      if (!plot?.crop) return [];
      return [{ cell, stage: plot.stage, needs: GARDEN_KIT.grow[plot.crop] }];
    });
  }

  // ---- Input ----------------------------------------------------------------------

  private onPointerMove(event: PointerEvent): void {
    this.touch = event.pointerType === 'touch';
    this.pointer = { x: event.clientX, y: event.clientY };
    this.cursor = null;
    const cell = this.view.pickCell(event.clientX, event.clientY);
    if (cell?.row !== this.hover?.row || cell?.col !== this.hover?.col || !this.touch) {
      this.hover = cell;
      this.refreshHover();
    }
  }

  private onPointerUp(event: PointerEvent): void {
    this.touch = event.pointerType === 'touch';
    this.pointer = { x: event.clientX, y: event.clientY };
    const cell = this.view.pickCell(event.clientX, event.clientY);
    this.hover = cell;
    this.cursor = null;
    if (cell && this.mode.kind === 'targeting') {
      void this.attempt(this.mode.index, this.targetFor(this.mode.card, cell));
      return;
    }
    this.refreshHover();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (this.mode.kind === 'intro' && event.key === 'Enter' && document.activeElement === document.body) {
      this.begin();
      return;
    }
    if (this.mode.kind !== 'choosing' && this.mode.kind !== 'targeting') return;

    if (/^[1-9]$/.test(event.key) && Number(event.key) <= this.game.hand.length) {
      event.preventDefault();
      this.chooseCard(Number(event.key) - 1);
      return;
    }
    if (this.mode.kind !== 'targeting') return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelTarget();
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const from = this.cursor ?? this.hover ?? { row: 1, col: 1 };
      this.cursor = {
        row: Math.min(this.game.rows - 1, Math.max(0, from.row + (this.cursor ? move[0] : 0))),
        col: Math.min(this.game.cols - 1, Math.max(0, from.col + (this.cursor ? move[1] : 0))),
      };
      this.refreshHover();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && this.cursor) {
      // Once the arrow keys have picked a plot, Enter means "use it here", even if a card button has focus.
      event.preventDefault();
      void this.attempt(this.mode.index, this.targetFor(this.mode.card, this.cursor));
    }
  }

  private targetFor(card: Card, cell: Cell): Target {
    return card.action === 'water' ? { row: cell.row } : { row: cell.row, col: cell.col };
  }

  private promptFor(card: Card): string {
    const verb = this.touch ? 'Tap' : 'Click';
    switch (card.action) {
      case 'plant':
        return `${verb} a plot to plant your ${card.crop} seed.`;
      case 'water':
        return `${verb} any plot in the row you want to water.`;
      default:
        return `${verb} a growing crop to spread compost on it.`;
    }
  }

  // ---- Hover feedback ---------------------------------------------------------------

  private refreshHover(): void {
    const cell = this.cursor ?? this.hover;
    const active = this.mode.kind === 'choosing' || this.mode.kind === 'targeting';
    const canvas = this.stage.renderer.domElement;
    if (!cell || !active) {
      this.view.highlight([]);
      this.hud.hideTooltip();
      canvas.style.cursor = '';
      return;
    }

    const plot = this.game.plotAt(cell);
    if (!plot) return;
    const content: TooltipContent = {
      title: `Row ${cell.row + 1} · Column ${cell.col + 1}`,
      lines: [SOIL_LINE[plot.soil]],
      note: this.game.isEdge(cell) ? 'Edge plot: rabbits can reach it' : 'Middle plot: safe from rabbits',
    };
    if (plot.crop) content.lines.push(`${capitalise(plot.crop)} · ${plot.stage} of ${GARDEN_KIT.grow[plot.crop]} stages`);
    else if (plot.soil !== 'stone') content.lines.push('Empty');

    if (this.mode.kind === 'targeting') {
      const verb = this.touch ? 'Tap' : this.cursor ? 'Press Enter' : 'Click';
      const { card } = this.mode;
      let cells: Cell[] = [cell];
      let warn = false;
      if (card.action === 'plant') {
        const crop = card.crop as CropType;
        if (plot.soil === 'stone') {
          warn = true;
          content.action = { text: 'Nothing grows on stone. Planting here wastes the seed and your turn.', tone: 'warn' };
        } else if (plot.crop) {
          warn = true;
          content.action = { text: `This plot already has a ${plot.crop} in it.`, tone: 'warn' };
        } else {
          content.action = { text: `${verb} to plant your ${crop} here.`, tone: 'ok' };
        }
      } else if (card.action === 'water') {
        cells = this.game.garden[cell.row].map((_, col) => ({ row: cell.row, col }));
        const growing = this.game.garden[cell.row].filter((p) => p.crop !== null).length;
        warn = growing === 0;
        content.action = warn
          ? { text: `Nothing is growing in row ${cell.row + 1}. Watering it still uses your turn.`, tone: 'warn' }
          : { text: `${verb} to water row ${cell.row + 1} (${growing} crop${growing === 1 ? '' : 's'} +1 stage).`, tone: 'ok' };
      } else if (card.action === 'compost') {
        warn = !plot.crop;
        content.action = plot.crop
          ? { text: `${verb} to give this ${plot.crop} 2 extra stages.`, tone: 'ok' }
          : { text: 'Nothing is growing there.', tone: 'warn' };
      }
      this.view.highlight(cells, warn ? 'warn' : 'ok');
      canvas.style.cursor = 'pointer';
    } else {
      this.view.highlight([]);
      canvas.style.cursor = '';
    }

    const at = this.cursor ? this.view.screenPosition(cell, 0.2) : this.pointer;
    this.hud.showTooltip(at.x, at.y, content);
  }

  private syncInsets(): void {
    const { top, bottom } = this.hud.insets();
    this.stage.setInsets(top, bottom);
  }
}
