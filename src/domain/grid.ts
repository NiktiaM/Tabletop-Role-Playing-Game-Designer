import type { Camera, Grid } from '../shared/campaign.js';
export interface Point { x: number; y: number }
export function screenToImage(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}
export function imageToScreen(point: Point, camera: Camera): Point {
  return { x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y };
}
export function imageToCell(point: Point, grid: Grid) {
  const r=[...(grid.regions??[])].reverse().find(r=>point.x>=r.x&&point.y>=r.y&&point.x<r.x+r.width&&point.y<r.y+r.height);
  const x=r?r.x+Math.floor((point.x-r.x)/r.cellSizePx)*r.cellSizePx:grid.originPx.x+Math.floor((point.x-grid.originPx.x)/grid.cellSizePx)*grid.cellSizePx;
  const y=r?r.y+Math.floor((point.y-r.y)/r.cellSizePx)*r.cellSizePx:grid.originPx.y+Math.floor((point.y-grid.originPx.y)/grid.cellSizePx)*grid.cellSizePx;
  return {column:Math.round((x-grid.originPx.x)/grid.cellSizePx*1e6)/1e6,row:Math.round((y-grid.originPx.y)/grid.cellSizePx*1e6)/1e6};
}
export function cellOrigin(column: number, row: number, grid: Grid): Point {
  return { x: grid.originPx.x + column * grid.cellSizePx, y: grid.originPx.y + row * grid.cellSizePx };
}
/** Visible grid segments clipped to both image and viewport; endpoints use image pixels. */
export function gridSegments(grid: Grid, width: number, height: number, camera: Camera, viewport: { width: number; height: number }): [Point, Point][] {
  if (!grid.visible || grid.cellSizePx * camera.zoom < 6) return [];
  const topLeft = screenToImage({x:0,y:0},camera);
  const bottomRight = screenToImage({x:viewport.width,y:viewport.height},camera);
  const left = Math.max(0,topLeft.x,grid.bounds?grid.originPx.x:0), top = Math.max(0,topLeft.y,grid.bounds?grid.originPx.y:0);
  const right = Math.min(width,bottomRight.x,grid.bounds?grid.originPx.x+grid.bounds.width:width), bottom = Math.min(height,bottomRight.y,grid.bounds?grid.originPx.y+grid.bounds.height:height);
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
/** Screen dragging changes only grid origin, independent of camera zoom. */
export function moveGrid(grid: Grid, dx: number, dy: number, zoom: number): Grid {
  return { ...grid, originPx: {
    x: Math.max(-8192,Math.min(8192,grid.originPx.x + dx/zoom)),
    y: Math.max(-8192,Math.min(8192,grid.originPx.y + dy/zoom)),
  } };
}
export function suggestedCellSize(width: number, height: number, cellsAcross: number): number {
  if (!Number.isFinite(cellsAcross) || cellsAcross<=0) throw new Error('Число клеток должно быть положительным');
  return Math.max(4,Math.min(4096,Math.min(width,height)/cellsAcross));
}
export function calibrateGrid(grid: Grid, start: Point, end: Point, meters: number): Grid {
  if (!Number.isFinite(meters) || meters<=0) throw new Error('Укажите положительную длину в метрах');
  const size=Math.hypot(end.x-start.x,end.y-start.y)/(meters/grid.metersPerCell);
  if (!Number.isFinite(size) || size<4 || size>4096) throw new Error('Полученный размер клетки должен быть от 4 до 4096 пикселей. Выберите более длинный отрезок или другую длину.');
  return {...grid,cellSizePx:size,originPx:{x:start.x,y:start.y},visible:true};
}
