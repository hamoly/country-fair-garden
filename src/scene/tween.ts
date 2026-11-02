// A tiny promise-based tween runner, driven by the render loop's tick().

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} satisfies Record<string, Ease>;

interface Job {
  start: number;
  duration: number;
  update: (t: number) => void;
  ease: Ease;
  resolve: () => void;
}

const jobs = new Set<Job>();
let clock = 0;

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animations run faster for people who prefer reduced motion. */
export const motionScale = reducedMotion ? 0.35 : 1;

export function tick(now: number): void {
  clock = now;
  for (const job of [...jobs]) {
    const t = Math.min(1, (now - job.start) / job.duration);
    job.update(job.ease(t));
    if (t >= 1) {
      jobs.delete(job);
      job.resolve();
    }
  }
}

/** Calls update(eased t) from 0 to 1 over `ms` milliseconds. */
export function tween(ms: number, update: (t: number) => void, easing: Ease = ease.outCubic): Promise<void> {
  return new Promise((resolve) => {
    const duration = Math.max(1, ms * motionScale);
    update(easing(0));
    jobs.add({ start: clock || performance.now(), duration, update, ease: easing, resolve });
  });
}

export function wait(ms: number): Promise<void> {
  return tween(ms, () => {});
}
