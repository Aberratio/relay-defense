import { describe, expect, it } from 'vitest';
import { SOLUTIONS } from './solutions';
import { SHOWCASE_LEVEL, SHOWCASE_PLAN, showcaseScene, showcaseStart } from '../src/ui/showcase';

describe('menu showcase', () => {
  it('follows the reference solution of its level', () => {
    const solution = SOLUTIONS.find((s) => s.level === SHOWCASE_LEVEL);
    expect(solution?.waves.slice(0, SHOWCASE_PLAN.length)).toEqual(SHOWCASE_PLAN);
  });

  it('reaches its wave with every action accepted and monsters on the board', () => {
    const start = showcaseStart();
    expect(start).not.toBeNull();
    expect(start!.wave).toBe(SHOWCASE_PLAN.length - 1);
    const scene = showcaseScene(start!);
    expect(scene.running()).toBe(true);
    expect(scene.enemies.length).toBeGreaterThan(0);
    expect(scene.lives).toBe(scene.maxLives);
    // The menu loops the wave from a copy: it must end, in the build phase, with no life lost.
    const loop = scene.clone();
    for (let t = 0; loop.running() && t < 30 * 120; t++) loop.step();
    expect(loop.phase).toBe('build');
    expect(loop.lives).toBe(loop.maxLives);
  });
});
