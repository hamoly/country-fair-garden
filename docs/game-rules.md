# Game rules

These are the rules of `mystery.js`, exactly as the game plays them. The numbers come from
`src/game/config.ts`, so if you change a setting there, update this page too.

## Goal

The fair wants **3 carrots, 2 tomatoes and 1 pumpkin**. Harvest at least that many within
**9 turns** to win a blue ribbon. Extra crops are fine. Long summer can add turns.

## The garden

The garden is 4 rows by 4 columns. Row 1 is at the back and column 1 is on the left, matching the
numbers around the plots.

|           | Column 1 | Column 2 | Column 3 | Column 4 |
|---|---|---|---|---|
| **Row 1** | plain | rich | plain | rich |
| **Row 2** | rich | *plain* | *plain* | plain |
| **Row 3** | plain | *plain* | *plain* | rich |
| **Row 4** | stone | rich | plain | stone |

- **12 plots are on the edge** (row 1, row 4, column 1 or column 4). Rabbits can reach them.
- **The 4 middle plots** (in italics) are safe from rabbits, and they're all plain soil.
- **All 5 rich plots are on the edge.** Fast growth comes with rabbit risk.
- **2 plots are stone:** row 4, columns 1 and 4.

## Soil

| Soil | Growth at the end of each turn |
|---|---|
| Plain | +1 stage |
| Rich | +3 stages |
| Stone | Nothing grows. Planting here wastes the seed **and** the turn. |

## Crops

| Crop | Stages to harvest | Ordered |
|---|---|---|
| Carrot | 3 | 3 |
| Tomato | 4 | 2 |
| Pumpkin | 5 | 1 |

A new seed starts at stage 0. A crop is harvested the moment its stage reaches or passes its
target. The plot is then empty again, and any extra stages are lost.

## A turn

1. **You're dealt 3 different cards.** The game draws at random from the deck and skips a card that
   is already in your hand.
2. **You play one card.** Some cards ask for a plot or a row (see below).
3. **Every crop grows** by its soil's amount.
4. **Ripe crops are harvested** and counted toward the order.
5. **A rabbit may visit** (see below).
6. **The order is checked.** If it's filled, you win straight away.

Growth and harvest happen **before** the rabbit. That's why a carrot planted on rich soil
(0 + 3 = 3 of 3) is always picked before a rabbit can reach it.

## The deck

The deck has 16 entries but only 7 different cards. A card listed more often is drawn more often.

| Card | Copies | Chance per draw | Chance it's in your hand |
|---|---|---|---|
| Plant a carrot seed | 3 | 18.75% | 54.3% |
| Plant a tomato seed | 3 | 18.75% | 54.3% |
| Plant a pumpkin seed | 3 | 18.75% | 54.3% |
| Water a row | 3 | 18.75% | 54.3% |
| Compost | 2 | 12.5% | 39.8% |
| Rain | 1 | 6.25% | 21.6% |
| Long summer | 1 | 6.25% | 21.6% |

The last column allows for the rule that a hand never repeats a card. The deck isn't used up:
every turn's hand is drawn from all 16 entries again.

## The cards

| Card | What you choose | What happens | Choices that don't use your turn |
|---|---|---|---|
| **Plant a seed** | A plot | The seed goes in at stage 0. | A plot that already has a crop |
| | | Planting on **stone** wastes the seed and **uses your turn**. | |
| **Water a row** | A row | Every crop in that row grows 1 extra stage. Empty plots stay empty. | None: watering a row with no crops **still uses your turn** |
| **Rain** | Nothing | Every crop in the garden grows 1 extra stage. | |
| **Compost** | A plot | That crop grows 2 extra stages. | A plot with nothing growing |
| **Long summer** | Nothing | You get 1 more turn. You can even use it on your last turn. | |

When a choice doesn't use your turn, the game shows the reason and you can pick again, with the
same card or another one from your hand. These are the same messages the console version printed:

- "That plot already has a tomato in it."
- "Nothing is growing there."

The console version also had "Choose a number from the list.", "That plot is not in the
garden." and "That row is not in the garden." Clicking plots means you can't make those mistakes,
but the rules engine still checks for them.

Extra stages from water, rain and compost are added straight away. The normal soil growth then
happens on top at the end of the turn.

## Rabbits

At the end of every turn, after the harvest, there's a **33% chance** a rabbit visits.

- It looks only at **edge plots** that have a crop.
- If there are any, it eats **one of them at random**. That crop is gone and the plot is empty.
- If none of the edge plots has a crop, it hops around and leaves.

## Winning and losing

- **Win:** at the end of a turn you have at least 3 carrots, 2 tomatoes and 1 pumpkin. The game
  ends straight away with *"You filled the order! Your produce wins a blue ribbon at the fair."*
- **Lose:** the last turn ends without the full order. *"The fair has arrived and the order isn't
  ready. Better luck next year."*

## Strategy notes

- **Carrots love rich soil.** A carrot on rich soil is ready the same turn you plant it, so rabbits
  can't touch it. Rich soil can produce one carrot every turn.
- **Tomatoes on rich soil take 2 turns** (3, then 6 of 4) and face one rabbit roll. On a safe middle
  plot they take 4 turns.
- **A pumpkin takes 2 turns on rich soil** and 5 turns on a safe middle plot. Water, rain or
  compost can speed it up.
- **Water works best on a full row.** One card can add a stage to up to four crops.
- **Avoid row 4, columns 1 and 4.** They're stone.

## How the rules map to `mystery.js`

| `mystery.js` lines | What it does | In this project |
|---|---|---|
| 3–13 | `GARDEN_KIT` settings | `GARDEN_KIT` in `src/game/config.ts` |
| 15–33 | `CARDS` and `DECK` | `CARDS` and `DECK` in `src/game/config.ts` |
| 35–60 | Starting garden | `GARDEN_LAYOUT` in `src/game/config.ts` |
| 64–70 | `getPlotLabel` | Plant tags in `src/scene/crops.ts`, plot tooltips in `src/controller.ts` |
| 72–84 | Rules screen | Start sheet in `src/ui/hud.ts` |
| 89 | Turn loop condition | `Game.over` in `src/game/engine.ts` |
| 93–103 | Garden map and order line | The 3D garden, and the order tag in `src/ui/hud.ts` |
| 111–122 | `before` snapshot of stages | `Game.beginTurn()` |
| 124–130 | Dealing the hand | `Game.beginTurn()` |
| 137–202 | Choosing and using a card | `Game.play()` |
| 204–233 | Growth, harvest and summary | `Game.endTurn()` |
| 235–254 | Rabbit raid | `Game.endTurn()` |
| 256–258 | Win check | `Game.endTurn()` |
| 261–285 | Final screen | End sheet in `src/ui/hud.ts` |

## Differences from the console version

- **Plots are clicked, not typed**, so a row or column outside the garden can't be entered.
- **Bad input doesn't crash it.** In the original, typing `two` or `1.5` made `hand[pick]` or
  `garden[row]` `undefined` and the program stopped with a `TypeError`. The rules engine checks for
  whole numbers in range instead.
- **Long summer adds turns to the current game** rather than changing `GARDEN_KIT.rules.turns`, so
  **Plant again** always starts with 9 turns.

Everything else, including the order of growth, harvest, rabbit and win check, is the same. The
tests in `src/game/engine.test.ts` replay the worksheet's Part F season turn by turn to prove it.
