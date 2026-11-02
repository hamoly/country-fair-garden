// Game settings, matching GARDEN_KIT, CARDS, DECK and garden in mystery.js (lines 3–60).
// The emoji icons from the console version live in the UI layer instead (src/ui/icons.ts).

export type CropType = 'carrot' | 'tomato' | 'pumpkin';
export type SoilType = 'plain' | 'rich' | 'stone';
export type ActionType = 'plant' | 'water' | 'rain' | 'compost' | 'summer';
export type CardId = 'carrot' | 'tomato' | 'pumpkin' | 'water' | 'rain' | 'compost' | 'summer';

export interface Card {
  readonly id: CardId;
  readonly name: string;
  readonly action: ActionType;
  readonly crop?: CropType;
}

export const CROPS: readonly CropType[] = ['carrot', 'tomato', 'pumpkin'];

export const GARDEN_KIT = {
  soil: {
    plain: { growth: 1 },
    rich: { growth: 3 },
    stone: { growth: 0 },
  },
  grow: { carrot: 3, tomato: 4, pumpkin: 5 },
  order: { carrot: 3, tomato: 2, pumpkin: 1 },
  rules: { turns: 9, handSize: 3, rabbitChance: 0.33 },
} as const satisfies {
  soil: Record<SoilType, { growth: number }>;
  grow: Record<CropType, number>;
  order: Record<CropType, number>;
  rules: { turns: number; handSize: number; rabbitChance: number };
};

export const CARDS: Readonly<Record<CardId, Card>> = {
  carrot: { id: 'carrot', name: 'Plant a carrot seed', action: 'plant', crop: 'carrot' },
  tomato: { id: 'tomato', name: 'Plant a tomato seed', action: 'plant', crop: 'tomato' },
  pumpkin: { id: 'pumpkin', name: 'Plant a pumpkin seed', action: 'plant', crop: 'pumpkin' },
  water: { id: 'water', name: 'Water a row: every crop in it grows 1 extra stage', action: 'water' },
  rain: { id: 'rain', name: 'Rain: every crop grows 1 extra stage', action: 'rain' },
  compost: { id: 'compost', name: 'Compost: one crop grows 2 extra stages', action: 'compost' },
  summer: { id: 'summer', name: 'Long summer: +1 turn', action: 'summer' },
};

// 16 entries but only 7 different card objects. Listing a card three times makes it
// three times as likely to be drawn (worksheet Q5–Q6).
export const DECK: readonly Card[] = [
  CARDS.carrot, CARDS.carrot, CARDS.carrot,
  CARDS.tomato, CARDS.tomato, CARDS.tomato,
  CARDS.pumpkin, CARDS.pumpkin, CARDS.pumpkin,
  CARDS.water, CARDS.water, CARDS.water,
  CARDS.rain,
  CARDS.compost, CARDS.compost,
  CARDS.summer,
];

// Row 1 is the first array. Every rich plot is on the edge; the middle four are plain.
export const GARDEN_LAYOUT: readonly (readonly SoilType[])[] = [
  ['plain', 'rich', 'plain', 'rich'],
  ['rich', 'plain', 'plain', 'plain'],
  ['plain', 'plain', 'plain', 'rich'],
  ['stone', 'rich', 'plain', 'stone'],
];

export function copiesInDeck(id: CardId): number {
  return DECK.filter((card) => card.id === id).length;
}
