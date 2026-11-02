# County Fair Garden

A turn-based garden card game for the browser. Grow **3 carrots, 2 tomatoes and 1 pumpkin** for
the county fair in **9 turns**, before the rabbits get them.

Built with TypeScript, Vite and three.js, with a 2.5D low-poly garden.

**Play it:** https://country-fair-garden.netlify.app/


<!--
  Screenshot: save one as docs/screenshot.png, then uncomment the line below.
  ![The garden on turn 4, with a tomato growing and three seed-packet cards in hand](docs/screenshot.png)
-->

## About

This is a rebuild of *Mystery Program 4* (`mystery.js`) from APPD 5000 Programming Fundamentals at
NSCC. The original runs in a terminal with `prompt-sync` and emoji. This version keeps the same
rules and replaces the text interface with a 3D garden you play with the mouse, touch or keyboard.

## Features

- **The original rules.** Same 16-card deck, same garden layout, same growth, harvest and rabbit
  logic. A test suite replays a full season and checks it against the worksheet trace.
- **2.5D garden.** A fixed orthographic camera looks at a floating island with raised beds. Crops
  grow stage by stage, and the rabbit hops in over the fence.
- **Seed-packet cards.** Each card shows what it does and how many copies are in the deck.
- **Plot hints.** Hovering a plot shows its soil, its crop's stage, whether rabbits can reach it,
  and what the selected card would do there.
- **Almanac.** A log of each turn's news, in the same words as the console version.
- **Keyboard and touch.** Play with the number keys and arrow keys, or tap on a phone.
- **Reduced motion.** Animations speed up when the system setting asks for less motion.

## How to play

1. Each turn you're dealt **3 different cards**. Pick one.
2. **Plant** a carrot, tomato or pumpkin seed, **water** a row, call the **rain**, spread
   **compost** on one crop, or take a **long summer** for an extra turn.
3. At the end of every turn each crop grows **1 stage on plain soil** and **3 on rich soil**.
   Nothing grows on **stone**, and planting there wastes the seed and the turn.
4. A crop is picked as soon as it's fully grown. Carrots take **3** stages, tomatoes **4** and
   pumpkins **5**.
5. About one turn in three, a **rabbit** eats a crop on an edge plot. The middle four plots are safe.

Fill the order before the turns run out to win a blue ribbon. The full rules are in
[docs/game-rules.md](docs/game-rules.md).

### Controls

| Action | Mouse or touch | Keyboard |
|---|---|---|
| Start the game | **Start planting** | `Enter` |
| Pick a card | Click a seed packet | `1` `2` `3` |
| Pick a plot or row | Click a plot | Arrow keys, then `Enter` |
| Choose a different card | **Choose again** | `Esc` |

## Getting started

You need [Node.js](https://nodejs.org/) 18.18 or newer. The project pins Node 22 in `.nvmrc`, so
with nvm you can run `nvm use`.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server with hot reload |
| `npm test` | Runs the rules tests with Vitest |
| `npm run typecheck` | Type-checks without building |
| `npm run build` | Type-checks, then builds the site into `dist/` |
| `npm run preview` | Serves the `dist/` build locally |

## Project structure

```
county-fair-garden/
├── index.html            Page shell, fonts and meta tags
├── public/favicon.svg
├── docs/                 Rules, architecture, development and deployment guides
└── src/
    ├── main.ts           Entry point and render loop
    ├── controller.ts     Connects input, rules, animations and HUD
    ├── style.css         HUD styles and colour tokens
    ├── game/             Rules engine (no DOM or three.js) and its tests
    ├── scene/            three.js stage, garden, crops, rabbit, particles, animations
    └── ui/               HUD and SVG icons
```

[docs/architecture.md](docs/architecture.md) explains how the pieces fit together.

## Documentation

| Guide | What's in it |
|---|---|
| [Game rules](docs/game-rules.md) | Every rule, the deck odds, and how each rule maps to `mystery.js` |
| [Architecture](docs/architecture.md) | Layers, the turn sequence, the rules engine API, the scene and HUD |
| [Development](docs/development.md) | Tests, type checking, and recipes for changing rules or adding cards and crops |

## Tech stack

- [TypeScript](https://www.typescriptlang.org/) in strict mode
- [Vite](https://vite.dev/) for the dev server and production build
- [three.js](https://threejs.org/) for the 3D garden, with `CSS2DRenderer` for labels
- [Vitest](https://vitest.dev/) for the rules tests
- Fonts: [Alfa Slab One](https://fonts.google.com/specimen/Alfa+Slab+One) and
  [Figtree](https://fonts.google.com/specimen/Figtree) from Google Fonts

All 3D models, icons and illustrations are drawn in code. There are no image or model files to
download.

## Author

Muhammad Muhammad, Halifax, Nova Scotia.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use,
modify and redistribute the game for noncommercial purposes, subject to the license terms.
Commercial use is not permitted without separate permission from the author.

Because it restricts commercial use, this is a source-available license and is not an OSI-approved
open-source license.
