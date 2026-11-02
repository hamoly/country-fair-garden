import './style.css';
import { Controller } from './controller';
import { GARDEN_LAYOUT } from './game/config';
import { GardenView } from './scene/garden-view';
import { Stage } from './scene/stage';
import { tick } from './scene/tween';
import { Hud } from './ui/hud';

const sceneHost = document.querySelector<HTMLElement>('#scene');
const hudHost = document.querySelector<HTMLElement>('#hud');

function start(sceneEl: HTMLElement, hudEl: HTMLElement): void {
  let stage: Stage;
  try {
    stage = new Stage(sceneEl);
  } catch (error) {
    hudEl.innerHTML = `<div class="overlay"><article class="sheet"><h1 class="title">County Fair Garden</h1>
      <p>This game draws the garden with WebGL, which this browser has turned off or doesn't support.
      Try a recent version of Chrome, Edge, Firefox or Safari.</p></article></div>`;
    console.error(error);
    return;
  }

  const view = new GardenView(stage, GARDEN_LAYOUT);
  const hud = new Hud(hudEl);
  new Controller(stage, view, hud);

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(now);
    view.update(now / 1000, dt);
    stage.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

if (sceneHost && hudHost) start(sceneHost, hudHost);
