import type { Backdrop } from '../../settings';
import { H, W } from '../../sim/constants';
import type { View } from '../camera';
import { faded, type Colors, type Ctx } from './common';
import { drawGym, drawGymLive, drawGymUp } from './gym';
import { drawNotebook, drawNotebookExt, drawNotebookLive } from './notebook';
import { drawStreet, drawStreetLive, drawStreetUp } from './street';
export { drawScoreboard, type ScoreLines } from './scoreboard';
export { WALL_BASE } from './common';

// Backdrops: what sits behind the court. Static parts go into the renderer's cached court layer
// (drawBackdrop); moving parts are drawn every frame (drawBackdropLive).

/** Floor colour for the backdrop: hardwood indoors, asphalt outside. */
export function floorFill(b: Backdrop, c: Colors): string {
  return b === 'street' ? c.faint : c.wood;
}

/**
 * `ext` is given when the layer reaches past the court (the follow camera): the wall, sky or
 * page then carries on to the edges of that rectangle. Without it the drawing is the court's own.
 */
export function drawBackdrop(real: Ctx, b: Backdrop, c: Colors, ext?: View): void {
  const ctx = faded(real);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (ext && (b === 'gym' || b === 'street')) {
    // Sideways: a wall carries on as a wall, so repeat the court's own end strips outwards.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.beginPath();
      if (side < 0) ctx.rect(ext.x, 0, -ext.x, H); else ctx.rect(W, 0, ext.x + ext.w - W, H);
      ctx.clip();
      ctx.translate(side * W, 0);
      if (b === 'gym') drawGym(ctx, c, { bleachers: false }); else drawStreet(ctx, c);
      ctx.restore();
    }
  }
  if (b === 'gym') drawGym(ctx, c, ext ? { bx0: ext.x } : {});
  if (b === 'street') drawStreet(ctx, c);
  if (b === 'notebook') drawNotebook(ctx, c);
  if (ext) {
    if (b === 'gym') drawGymUp(ctx, c, ext.x, ext.x + ext.w, ext.y);
    if (b === 'street') drawStreetUp(ctx, c, ext);
    if (b === 'notebook') drawNotebookExt(ctx, c, ext);
  }
  ctx.restore();
}

export function drawBackdropLive(real: Ctx, b: Backdrop, c: Colors, time: number): void {
  const ctx = faded(real);
  ctx.save();
  if (b === 'gym') drawGymLive(ctx, c, time);
  if (b === 'street') drawStreetLive(ctx, c, time);
  if (b === 'notebook') drawNotebookLive(ctx, c, time);
  ctx.restore();
}
