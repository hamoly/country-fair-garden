import { describe, expect, it } from 'vitest';
import { Game, type Rng, type RngPurpose } from './engine';

// A random-number generator that hands out scripted values, one queue per purpose.
function scripted(values: Partial<Record<RngPurpose, number[]>>): Rng {
  const queues = { deal: [...(values.deal ?? [])], rabbit: [...(values.rabbit ?? [])], rabbitTarget: [...(values.rabbitTarget ?? [])] };
  return (purpose) => {
    const next = queues[purpose].shift();
    if (next === undefined) throw new Error(`No scripted "${purpose}" value left`);
    return next;
  };
}

// Math.random() values that land on each card: index = floor(value * 16).
const DRAW = { carrot: 0.01, tomato: 0.25, pumpkin: 0.4, water: 0.6, rain: 0.79, compost: 0.85, summer: 0.99 } as const;
type DrawCard = keyof typeof DRAW;

/** A hand whose first card is `first`, padded with two other cards. */
function handStartingWith(first: DrawCard): number[] {
  const fillers: DrawCard[] = first === 'water' || first === 'rain' ? ['compost', 'pumpkin'] : ['water', 'rain'];
  return [DRAW[first], ...fillers.map((card) => DRAW[card])];
}

describe('dealing a hand (worksheet Q16–Q17)', () => {
  it('skips a second copy of the same card object', () => {
    const game = new Game(scripted({ deal: [0.1, 0.15, 0.62, 0.7, 0.99] }));
    expect(game.hand.map((card) => card.id)).toEqual(['carrot', 'water', 'summer']);
  });
});

describe('choosing a card (worksheet Q18–Q21)', () => {
  const fresh = () => new Game(scripted({ deal: handStartingWith('tomato'), rabbit: [0.9] }));

  it('asks again for a number outside the hand', () => {
    const game = fresh();
    expect(game.play(-1)).toEqual({ kind: 'retry', message: 'Choose a number from the list.' });
    expect(game.play(3)).toEqual({ kind: 'retry', message: 'Choose a number from the list.' });
    expect(game.play(0.5)).toEqual({ kind: 'retry', message: 'Choose a number from the list.' });
    expect(game.cardPlayed).toBe(false);
  });

  it('wastes the seed and the turn on stone', () => {
    const game = fresh();
    const outcome = game.play(0, { row: 3, col: 0 });
    expect(outcome.kind).toBe('done');
    expect(game.garden[3][0].crop).toBeNull();
    expect(game.cardPlayed).toBe(true);
  });

  it('asks again for a plot outside the garden or an occupied plot', () => {
    const game = fresh();
    expect(game.play(0, { row: 4, col: 0 })).toEqual({ kind: 'retry', message: 'That plot is not in the garden.' });
    expect(game.play(0, { row: -1, col: 2 })).toEqual({ kind: 'retry', message: 'That plot is not in the garden.' });
    game.garden[1][1].crop = 'carrot';
    expect(game.play(0, { row: 1, col: 1 })).toEqual({ kind: 'retry', message: 'That plot already has a carrot in it.' });
  });

  it('asks again when composting an empty plot, but uses the turn when watering an empty row', () => {
    const compost = new Game(scripted({ deal: handStartingWith('compost') }));
    expect(compost.play(0, { row: 1, col: 1 })).toEqual({ kind: 'retry', message: 'Nothing is growing there.' });
    expect(compost.cardPlayed).toBe(false);

    const water = new Game(scripted({ deal: handStartingWith('water') }));
    const outcome = water.play(0, { row: 1 });
    expect(outcome.kind).toBe('done');
    expect(water.cardPlayed).toBe(true);
  });
});

describe('Long summer (worksheet Q13)', () => {
  it('adds a turn even when chosen on the last turn', () => {
    const deal = [...Array.from({ length: 8 }, () => handStartingWith('water')).flat(), DRAW.summer, DRAW.water, DRAW.rain, ...handStartingWith('water')];
    const game = new Game(scripted({ deal, rabbit: Array(10).fill(0.9) }));
    for (let turn = 1; turn <= 8; turn++) {
      game.play(0, { row: 0 });
      game.endTurn();
    }
    expect(game.turn).toBe(9);
    game.play(0); // Long summer
    expect(game.endTurn().over).toBe(false);
    expect(game.turn).toBe(10);
    expect(game.turns).toBe(10);
    game.play(0, { row: 0 });
    expect(game.endTurn().over).toBe(true);
  });
});

describe('a carrot on rich soil (worksheet Q26)', () => {
  it('is harvested before the rabbit looks, so the rabbit finds nothing', () => {
    // Two hands: this turn's, and the one dealt for turn 2 after endTurn().
    const game = new Game(scripted({ deal: [...handStartingWith('carrot'), ...handStartingWith('carrot')], rabbit: [0.0] }));
    game.play(0, { row: 0, col: 1 });
    const report = game.endTurn();
    expect(report.growth[0].harvested).toBe(true);
    expect(report.rabbit?.ate).toBeNull();
    expect(report.harvest.carrot).toBe(1);
  });
});

describe('the worksheet season (Part F, Q27–Q30)', () => {
  // [card, target] for turns 1–8, exactly as the worksheet lists them (1-based → 0-based).
  const plays: [DrawCard, { row: number; col?: number }][] = [
    ['pumpkin', { row: 1, col: 1 }],
    ['carrot', { row: 0, col: 1 }],
    ['water', { row: 1 }],
    ['tomato', { row: 3, col: 0 }],
    ['tomato', { row: 2, col: 1 }],
    ['carrot', { row: 1, col: 0 }],
    ['tomato', { row: 0, col: 3 }],
    ['compost', { row: 2, col: 1 }],
  ];

  const expected = [
    { news: 'You planted a pumpkin in plain soil.', growth: ['pumpkin row 2, column 2: new → 1/5'], rabbit: null, harvest: [0, 0, 0] },
    { news: 'You planted a carrot in rich soil.', growth: ['carrot row 1, column 2: new → harvested!', 'pumpkin row 2, column 2: 1/5 → 2/5'], rabbit: null, harvest: [1, 0, 0] },
    { news: 'You watered row 2.', growth: ['pumpkin row 2, column 2: 2/5 → 4/5'], rabbit: null, harvest: [1, 0, 0] },
    { news: 'Nothing grows on stone. Your tomato seed is wasted and you lose your turn.', growth: ['pumpkin row 2, column 2: 4/5 → harvested!'], rabbit: null, harvest: [1, 0, 1] },
    { news: 'You planted a tomato in plain soil.', growth: ['tomato row 3, column 2: new → 1/4'], rabbit: 'A rabbit hopped around the edge but found nothing to eat.', harvest: [1, 0, 1] },
    { news: 'You planted a carrot in rich soil.', growth: ['carrot row 2, column 1: new → harvested!', 'tomato row 3, column 2: 1/4 → 2/4'], rabbit: 'A rabbit hopped around the edge but found nothing to eat.', harvest: [2, 0, 1] },
    { news: 'You planted a tomato in rich soil.', growth: ['tomato row 1, column 4: new → 3/4', 'tomato row 3, column 2: 2/4 → 3/4'], rabbit: 'A rabbit ate the tomato in row 1, column 4!', harvest: [2, 0, 1] },
    { news: 'You spread compost on the tomato.', growth: ['tomato row 3, column 2: 3/4 → harvested!'], rabbit: null, harvest: [2, 1, 1] },
  ];

  const season = () =>
    new Game(
      scripted({
        deal: [...plays.flatMap(([card]) => handStartingWith(card)), ...handStartingWith('carrot')],
        rabbit: [0.9, 0.9, 0.9, 0.9, 0.2, 0.1, 0.25, 0.9, 0.9],
        rabbitTarget: [0.5],
      }),
    );

  it('matches the trace table turn by turn', () => {
    const game = season();
    plays.forEach(([, target], i) => {
      expect(game.play(0, target).kind).toBe('done');
      const report = game.endTurn();
      const want = expected[i];
      expect(report.turn).toBe(i + 1);
      expect(report.action.text).toBe(want.news);
      expect(report.growth.map((g) => g.text)).toEqual(want.growth);
      expect(report.rabbit?.news.text ?? null).toBe(want.rabbit);
      expect([report.harvest.carrot, report.harvest.tomato, report.harvest.pumpkin]).toEqual(want.harvest);
    });
  });

  it('prints the turn 2 news exactly as the top of turn 3 shows it (Q28)', () => {
    const game = season();
    game.play(0, plays[0][1]);
    game.endTurn();
    game.play(0, plays[1][1]);
    expect(Game.newsLines(game.endTurn())).toEqual([
      'You planted a carrot in rich soil.',
      'Every crop grew: 1 stage on plain soil, 3 on rich soil.',
      '',
      'This turn:',
      '  carrot row 1, column 2: new → harvested!',
      '  pumpkin row 2, column 2: 1/5 → 2/5',
    ]);
  });

  it('leaves the garden empty with the order out of reach on turn 9 (Q29–Q30)', () => {
    const game = season();
    plays.forEach(([, target]) => {
      game.play(0, target);
      game.endTurn();
    });
    expect(game.turn).toBe(9);
    expect(game.garden.flat().every((plot) => plot.crop === null)).toBe(true);

    // Best possible last move: a carrot on rich soil fills carrots, but tomatoes stay at 1 of 2.
    game.play(0, { row: 0, col: 1 });
    const report = game.endTurn();
    expect(report.harvest).toEqual({ carrot: 3, tomato: 1, pumpkin: 1 });
    expect(report.won).toBe(false);
    expect(report.over).toBe(true);
  });
});
