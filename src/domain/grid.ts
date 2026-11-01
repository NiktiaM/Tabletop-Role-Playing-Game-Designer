import type { Camera, Grid } from '../shared/campaign.js';
export interface Point { x: number; y: number }
export function screenToImage(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}
export function imageToScreen(point: Point, camera: Camera): Point {
  return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
}
export function imageToCell(point: Point, grid: Grid) {
  return { column: Math.floor((point.x - grid.originPx.x) / grid.cellSizePx), row: Math.floor((point.y - grid.originPx.y) / grid.cellSizePx) };
}
export function cellOrigin(column: number, row: number, grid: Grid): Point {
  return { x: grid.originPx.x + column * grid.cellSizePx, y: grid.originPx.y + row * grid.cellSizePx };
}
/** Visible grid segments clipped to both image and viewport; endpoints use image pixels. */
export function gridSegments(grid: Grid, width: number, height: number, camera: Camera, viewport: { width: number; height: number }): [Point, Point][] {
  if (!grid.visible || grid.cellSizePx * camera.zoom < 6) return [];
  const topLeft = screenToImage({x:0,y:0},camera);
  const bottomRight = screenToImage({x:viewport.width,y:viewport.height},camera);
  const left = Math.max(0,topLeft.x), top = Math.max(0,topLeft.y);
  const right = Math.min(width,bottomRight.x), bottom = Math.min(height,bottomRight.y);
  if (right < left || bottom < top) return [];
  const segments: [Point, Point][] = [];
  const step = grid.cellSizePx;
  for (let column = Math.ceil((left-grid.originPx.x)/step); ; column++) {
    const x=grid.originPx.x+column*step; if(x>right) break;
    segments.push([{x,y:top},{x,y:bottom}]);
  }
  for (let row = Math.ceil((top-grid.originPx.y)/step); ; row++) {
    const y=grid.originPx.y+row*step; if(y>bottom) break;
    segments.push([{x:left,y},{x:right,y}]);
  }
  return segments;
}
