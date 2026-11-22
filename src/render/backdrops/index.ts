import type { Backdrop } from '../../settings';
import type { Colors, Ctx } from './common';
import { drawGym, drawGymLive } from './gym';
import { drawNotebook, drawNotebookLive } from './notebook';
import { drawStreet, drawStreetLive } from './street';
export { drawScoreboard, type ScoreLines } from './scoreboard';
export { WALL_BASE } from './common';

// Backdrops: what sits behind the court. Static parts go into the renderer's cached court layer
// (drawBackdrop); moving parts are drawn every frame (drawBackdropLive).

/** Floor colour for the backdrop: hardwood indoors, asphalt outside. */
export function floorFill(b: Backdrop, c: Colors): string {
  return b === 'street' ? c.faint : c.wood;
}

export function drawBackdrop(ctx: Ctx, b: Backdrop, c: Colors): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (b === 'gym') drawGym(ctx, c);
  if (b === 'street') drawStreet(ctx, c);
  if (b === 'notebook') drawNotebook(ctx, c);
  ctx.restore();
}

export function drawBackdropLive(ctx: Ctx, b: Backdrop, c: Colors, time: number): void {
  ctx.save();
  if (b === 'gym') drawGymLive(ctx, c, time);
  if (b === 'street') drawStreetLive(ctx, c, time);
  if (b === 'notebook') drawNotebookLive(ctx, c, time);
  ctx.restore();
}
