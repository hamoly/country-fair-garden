// The rules of mystery.js as a pure, testable class. No DOM, no three.js.
// Comments point at the matching lines of the original console program.

import {
  CROPS,
  DECK,
  GARDEN_KIT,
  GARDEN_LAYOUT,
  type Card,
  type CardId,
  type CropType,
  type SoilType,
} from './config';

/** Where a random number is used. Tests pass a scripted generator per purpose. */
export type RngPurpose = 'deal' | 'rabbit' | 'rabbitTarget';
export type Rng = (purpose: RngPurpose) => number;

export interface Plot {
  readonly soil: SoilType;
  crop: CropType | null;
  stage: number;
}

/** Zero-based indexes, like garden[row][col]. The UI shows row + 1 and col + 1. */
export interface Cell {
  row: number;
  col: number;
}

/** Plant and compost need a row and column; water needs only a row. */
export interface Target {
  row: number;
  col?: number;
}

export type NewsIcon = CardId | 'stone' | 'grew' | 'rabbit';

export interface NewsLine {
  icon: NewsIcon;
  text: string;
}

export type Effect =
  | { type: 'plant'; cell: Cell; crop: CropType }
  | { type: 'wasted'; cell: Cell; crop: CropType }
  | { type: 'water'; row: number; grown: Cell[] }
  | { type: 'rain'; grown: Cell[] }
  | { type: 'compost'; cell: Cell }
  | { type: 'summer'; turns: number };

export type PlayOutcome =
  /** Nothing changed; the player chooses again (the console version went back to line 139). */
  | { kind: 'retry'; message: string }
  /** The card was used. Call endTurn() next. */
  | { kind: 'done'; card: Card; effect: Effect; news: NewsLine };

export interface GrowthEntry extends Cell {
  crop: CropType;
  /** Stage at the start of the turn, or null if planted this turn ("new"). */
  start: number | null;
  /** Stage just before end-of-turn growth (after water, rain or compost). */
  from: number;
  /** Stage after growth. */
  to: number;
  needs: number;
  harvested: boolean;
  /** Summary line, e.g. "tomato row 2, column 3: 2/4 → harvested!" */
  text: string;
}

export interface RabbitEvent {
  /** The crop the rabbit ate, or null if no edge plot had a crop. */
  ate: (Cell & { crop: CropType }) | null;
  edgeCrops: Cell[];
  news: NewsLine;
}

export interface TurnReport {
  turn: number;
  action: NewsLine;
  growth: GrowthEntry[];
  growthNews: NewsLine | null;
  rabbit: RabbitEvent | null;
  harvest: Record<CropType, number>;
  won: boolean;
  over: boolean;
}

export function isEdge(cell: Cell, rows: number, cols: number): boolean {
  // mystery.js line 239
  return cell.row === 0 || cell.row === rows - 1 || cell.col === 0 || cell.col === cols - 1;
}

export class Game {
  readonly garden: Plot[][];
  readonly harvest: Record<CropType, number> = { carrot: 0, tomato: 0, pumpkin: 0 };
  /** Can grow with Long summer, so it lives on the game, not in GARDEN_KIT. */
  turns: number = GARDEN_KIT.rules.turns;
  turn = 1;
  won = false;
  hand: Card[] = [];

  private before: (number | null)[][] = [];
  private played: NewsLine | null = null;

  constructor(private readonly rng: Rng = () => Math.random()) {
    this.garden = GARDEN_LAYOUT.map((row) => row.map((soil) => ({ soil, crop: null, stage: 0 })));
    this.beginTurn();
  }

  get rows(): number {
    return this.garden.length;
  }

  get cols(): number {
    return this.garden[0].length;
  }

  /** The for-loop condition on line 89, negated. */
  get over(): boolean {
    return this.won || this.turn > this.turns;
  }

  /** True after a card was played and before endTurn() runs. */
  get cardPlayed(): boolean {
    return this.played !== null;
  }

  plotAt(cell: Cell): Plot | undefined {
    return this.garden[cell.row]?.[cell.col];
  }

  isEdge(cell: Cell): boolean {
    return isEdge(cell, this.rows, this.cols);
  }

  needs(crop: CropType): number {
    return GARDEN_KIT.grow[crop];
  }

  /** Lines 111–130: remember each crop's stage, then deal a hand of different cards. */
  private beginTurn(): void {
    this.before = this.garden.map((row) => row.map((plot) => (plot.crop === null ? null : plot.stage)));

    const hand: Card[] = [];
    while (hand.length < GARDEN_KIT.rules.handSize) {
      const index = Math.min(DECK.length - 1, Math.floor(this.rng('deal') * DECK.length));
      const card = DECK[index];
      // includes() compares objects by identity, so a second CARDS.carrot counts as a repeat.
      if (!hand.includes(card)) hand.push(card);
    }
    this.hand = hand;
  }

  /** Lines 137–202: use one card from the hand. */
  play(handIndex: number, target?: Target): PlayOutcome {
    if (this.over) throw new Error('The game is over.');
    if (this.played) throw new Error('A card was already played this turn. Call endTurn().');

    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= this.hand.length) {
      return retry('Choose a number from the list.');
    }
    const card = this.hand[handIndex];

    switch (card.action) {
      case 'plant': {
        const cell = this.cellFrom(target);
        if (!cell) return retry('That plot is not in the garden.');
        const plot = this.garden[cell.row][cell.col];
        const crop = card.crop as CropType;
        if (plot.soil === 'stone') {
          return this.use(card, { type: 'wasted', cell, crop }, {
            icon: 'stone',
            text: `Nothing grows on stone. Your ${crop} seed is wasted and you lose your turn.`,
          });
        }
        if (plot.crop !== null) return retry(`That plot already has a ${plot.crop} in it.`);
        plot.crop = crop;
        plot.stage = 0;
        return this.use(card, { type: 'plant', cell, crop }, {
          icon: crop,
          text: `You planted a ${crop} in ${plot.soil} soil.`,
        });
      }

      case 'water': {
        const row = target?.row;
        if (row === undefined || !Number.isInteger(row) || row < 0 || row >= this.rows) {
          return retry('That row is not in the garden.');
        }
        const grown: Cell[] = [];
        this.garden[row].forEach((plot, col) => {
          if (plot.crop !== null) {
            plot.stage += 1;
            grown.push({ row, col });
          }
        });
        return this.use(card, { type: 'water', row, grown }, { icon: 'water', text: `You watered row ${row + 1}.` });
      }

      case 'rain': {
        const grown: Cell[] = [];
        this.forEachPlot((plot, cell) => {
          if (plot.crop !== null) {
            plot.stage += 1;
            grown.push(cell);
          }
        });
        return this.use(card, { type: 'rain', grown }, { icon: 'rain', text: 'Rain soaked the whole garden.' });
      }

      case 'compost': {
        const cell = this.cellFrom(target);
        if (!cell) return retry('That plot is not in the garden.');
        const plot = this.garden[cell.row][cell.col];
        if (plot.crop === null) return retry('Nothing is growing there.');
        plot.stage += 2;
        return this.use(card, { type: 'compost', cell }, {
          icon: 'compost',
          text: `You spread compost on the ${plot.crop}.`,
        });
      }

      case 'summer': {
        this.turns += 1;
        return this.use(card, { type: 'summer', turns: this.turns }, {
          icon: 'summer',
          text: `A long summer! You now have ${this.turns} turns.`,
        });
      }
    }
  }

  /** Lines 204–258: every crop grows, ripe crops are harvested, then a rabbit may visit. */
  endTurn(): TurnReport {
    if (!this.played) throw new Error('Play a card before ending the turn.');
    const action = this.played;
    this.played = null;

    // Growth and harvest (lines 204–229). This runs before the rabbit, so a carrot on
    // rich soil (0 + 3 = 3 of 3) is always harvested before a rabbit can reach it.
    const growth: GrowthEntry[] = [];
    this.forEachPlot((plot, cell) => {
      if (plot.crop === null) return;
      const crop = plot.crop;
      const from = plot.stage;
      plot.stage += GARDEN_KIT.soil[plot.soil].growth;
      const to = plot.stage;
      const needs = GARDEN_KIT.grow[crop];
      const start = this.before[cell.row][cell.col];
      const harvested = to >= needs;
      if (harvested) {
        this.harvest[crop] += 1;
        plot.crop = null;
        plot.stage = 0;
      }
      const startText = start === null ? 'new' : `${start}/${needs}`;
      const endText = harvested ? 'harvested!' : `${to}/${needs}`;
      growth.push({
        ...cell,
        crop,
        start,
        from,
        to,
        needs,
        harvested,
        text: `${crop} row ${cell.row + 1}, column ${cell.col + 1}: ${startText} → ${endText}`,
      });
    });

    const growthNews: NewsLine | null = growth.length
      ? {
          icon: 'grew',
          text: `Every crop grew: ${GARDEN_KIT.soil.plain.growth} stage on plain soil, ${GARDEN_KIT.soil.rich.growth} on rich soil.`,
        }
      : null;

    // Rabbit raid (lines 235–254).
    let rabbit: RabbitEvent | null = null;
    if (this.rng('rabbit') < GARDEN_KIT.rules.rabbitChance) {
      const edgeCrops: Cell[] = [];
      this.forEachPlot((plot, cell) => {
        if (this.isEdge(cell) && plot.crop !== null) edgeCrops.push(cell);
      });
      if (edgeCrops.length > 0) {
        const pick = Math.min(edgeCrops.length - 1, Math.floor(this.rng('rabbitTarget') * edgeCrops.length));
        const target = edgeCrops[pick];
        const eaten = this.garden[target.row][target.col];
        const crop = eaten.crop as CropType;
        eaten.crop = null;
        eaten.stage = 0;
        rabbit = {
          ate: { ...target, crop },
          edgeCrops,
          news: { icon: 'rabbit', text: `A rabbit ate the ${crop} in row ${target.row + 1}, column ${target.col + 1}!` },
        };
      } else {
        rabbit = {
          ate: null,
          edgeCrops,
          news: { icon: 'rabbit', text: 'A rabbit hopped around the edge but found nothing to eat.' },
        };
      }
    }

    // Win check (lines 256–258).
    if (CROPS.every((crop) => this.harvest[crop] >= GARDEN_KIT.order[crop])) this.won = true;

    const turn = this.turn;
    this.turn += 1; // turn++ on line 89
    if (!this.over) this.beginTurn();

    return {
      turn,
      action,
      growth,
      growthNews,
      rabbit,
      harvest: { ...this.harvest },
      won: this.won,
      over: this.over,
    };
  }

  /** Every news line for a finished turn, in the order mystery.js printed them. */
  static newsLines(report: TurnReport): string[] {
    const lines = [report.action.text];
    if (report.growthNews) {
      lines.push(report.growthNews.text, '', 'This turn:', ...report.growth.map((g) => `  ${g.text}`));
    }
    if (report.rabbit) lines.push('', report.rabbit.news.text);
    return lines;
  }

  private use(card: Card, effect: Effect, news: NewsLine): PlayOutcome {
    this.played = news;
    return { kind: 'done', card, effect, news };
  }

  private cellFrom(target: Target | undefined): Cell | null {
    if (!target || target.col === undefined) return null;
    const { row, col } = target;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return { row, col };
  }

  private forEachPlot(fn: (plot: Plot, cell: Cell) => void): void {
    this.garden.forEach((rowPlots, row) => rowPlots.forEach((plot, col) => fn(plot, { row, col })));
  }
}

function retry(message: string): PlayOutcome {
  return { kind: 'retry', message };
}

export const WIN_MESSAGE = 'You filled the order! Your produce wins a blue ribbon at the fair.';
export const LOSE_MESSAGE = "The fair has arrived and the order isn't ready. Better luck next year.";
