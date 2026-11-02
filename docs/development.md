# Development guide

## Set up

```bash
nvm use        # optional: switches to Node 22 from .nvmrc
npm install
npm run dev    # http://localhost:5173, reloads as you save
```

Any Node.js version from 18.18 works.

## Checks

| Command | Run it when |
|---|---|
| `npm test` | You change anything in `src/game/` |
| `npm run typecheck` | Before committing |
| `npm run build` | Before pushing. Netlify runs the same command, so if it passes here it should pass there. |

TypeScript runs in strict mode with `noUnusedLocals` and `noUnusedParameters`. `verbatimModuleSyntax`
is on, so type-only imports need the `type` keyword: `import { type Card } from './config'`.

## Tests

`src/game/engine.test.ts` tests the rules engine with [Vitest](https://vitest.dev/). The tests
include:

- dealing a hand that never repeats a card
- every "choose again" case, plus the two mistakes that use up the turn (stone and an empty row)
- Long summer on the last turn
- a carrot on rich soil being picked before a rabbit can reach it
- the worksheet's **Part F** season, replayed turn by turn, with the exact news text for turn 2

### Writing a test

Pass `Game` a scripted random-number generator, so every deal and rabbit roll is known in advance.
A deal value `v` picks `DECK[Math.floor(v * 16)]`.

```ts
import { expect, it } from 'vitest';
import { Game, type Rng } from './engine';

it('grows a tomato on rich soil to 3 of 4 in one turn', () => {
  const values = { deal: [0.25, 0.6, 0.79, 0.25, 0.6, 0.79], rabbit: [0.9], rabbitTarget: [] as number[] };
  const rng: Rng = (purpose) => values[purpose].shift()!;

  const game = new Game(rng);              // hand: tomato, water, rain
  game.play(0, { row: 0, col: 1 });        // plant the tomato in row 1, column 2 (rich)
  const report = game.endTurn();

  expect(report.growth[0].to).toBe(3);
  expect(report.rabbit).toBeNull();        // 0.9 is above the 0.33 rabbit chance
});
```

Each `endTurn()` deals the next hand, so give enough `deal` values for that hand too.

Only the rules engine has tests. The scene and HUD are checked by playing the game.

## Recipes

### Change a number in the rules

Edit `GARDEN_KIT` in `src/game/config.ts`: soil growth, stages per crop, the order, turns, hand size
or rabbit chance. The start sheet, cards, order tag and tooltips all read from it. Then:

1. Update the numbers in `docs/game-rules.md` and the README.
2. Run `npm test`. The Part F tests assume the original numbers, so they will fail. That's
   expected if you meant to change the rules.

### Change the garden layout

Edit `GARDEN_LAYOUT` in `src/game/config.ts`. Use `'plain'`, `'rich'` or `'stone'`, and keep it
4 × 4. The camera framing, fence and labels are sized for 4 × 4.

### Change how often a card comes up

Add or remove copies in `DECK`. The "x of 16 in the deck" line on each card updates itself. The
odds table in `docs/game-rules.md` doesn't.

### Add a new card

Say you want a **Scarecrow** card that keeps rabbits away for one turn.

1. **`src/game/config.ts`**: add `'scarecrow'` to `CardId` and a new action to `ActionType`, add
   the card to `CARDS`, and add copies to `DECK`.
2. **`src/game/engine.ts`**: add a `case` for the action in `Game.play()`, and a new `Effect` type.
   For a lasting effect, store it on the `Game` and check it in `endTurn()`, here by skipping the
   rabbit roll.
3. **`src/ui/icons.ts`** and **`src/ui/hud.ts`**: TypeScript will flag `ICONS` and `CARD_STYLE`
   until each has an entry for the new card id. Add an SVG icon, an ink colour and a kind label
   (`Seeds`, `Chore` or `Weather`).
4. **`src/scene/garden-view.ts`**: add an animation method, such as a scarecrow popping up in the
   middle.
5. **`src/controller.ts`**: handle the new effect in `playOut()`. If the card needs a plot or row,
   add it to the check in `chooseCard()`, then give it a prompt in `promptFor()` and a hint in
   `refreshHover()`.
6. Add a test, and add the card to `docs/game-rules.md`.

### Add a new crop

1. **`src/game/config.ts`**: add it to `CropType` and `CROPS`, and give it entries in
   `GARDEN_KIT.grow` and `GARDEN_KIT.order`. Add a planting card and its copies in `DECK`.
2. **`src/scene/crops.ts`**: add a `build…()` method that returns a function taking progress from
   0 to 1, and register it in the `builders` record. Add its colours to `src/scene/palette.ts`.
3. **`src/ui/icons.ts`** and **`src/ui/hud.ts`**: add an icon, a `CROP_LABEL` entry and a
   `CARD_STYLE` entry. The order tag adds a row by itself.
4. Check the order tag on a phone. It's sized for three rows.

### Adjust the camera

In `src/scene/stage.ts`:

- `FIT_WIDTH`, `FIT_HEIGHT` and `FIT_WIDTH_NARROW` set how much of the island has to fit on screen.
  Smaller numbers zoom in.
- `azimuth` and `elevation` in the constructor set the viewing angle. Lower elevation looks more
  side-on, and higher looks more top-down.

### Change colours or fonts

- HUD colours and fonts are tokens at the top of `src/style.css`.
- 3D colours are in `src/scene/palette.ts`.
- Fonts are loaded in `index.html`. If you switch to a font from somewhere other than Google Fonts,
  also update the Content Security Policy in `netlify.toml` (see
  [deployment.md](deployment.md#the-content-security-policy)).

## Debugging tips

- To see the rules without animations, use `Game.newsLines(report)`. It prints the same text as the
  original console program.
- If clicks don't reach the garden, check that the HUD element in front has `pointer-events: none`.
  Only buttons and panels turn pointer events back on.
- If a label lingers after a crop is removed, the `CSS2DObject` wasn't removed from its parent.
  `CropModel.dispose()` removes the tag first, which takes its element out of the page.
- To slow every animation down, raise `motionScale` in `src/scene/tween.ts` for a moment, for
  example to `3`.
