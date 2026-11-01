import { expect, test } from 'vitest';
import { imageToCell, cellOrigin, screenToImage, imageToScreen, gridSegments } from '../src/domain/grid.js';
import { gridSchema } from '../src/shared/campaign.js';
const grid = {cellSizePx:80.5,originPx:{x:17.25,y:-23.5},visible:true};
test('одна клетка сохраняется при разных масштабах и смещениях камеры', () => {
 const origin=cellOrigin(5,8,grid);
 const point={x:origin.x+grid.cellSizePx/2,y:origin.y+grid.cellSizePx/2};
 for(const camera of [{x:0,y:0,zoom:1},{x:340,y:-281,zoom:0.13},{x:-125,y:60,zoom:8}]) {
  const restored=screenToImage(imageToScreen(point,camera),camera);
  expect(restored.x).toBeCloseTo(point.x); expect(restored.y).toBeCloseTo(point.y);
  expect(imageToCell(restored,grid)).toEqual({column:5,row:8});
 }
 expect(imageToCell({x:17.24,y:-23.51},grid)).toEqual({column:-1,row:-1});
 expect(imageToCell(grid.originPx,grid)).toEqual({column:0,row:0});
});
test('линии ограничены изображением и видимой областью; начало соответствует калибровке', () => {
 const camera={x:-30,y:10,zoom:0.5};
 const segments=gridSegments(grid,4000,4000,camera,{width:800,height:600});
 expect(segments.length).toBeGreaterThan(10);
 for(const [a,b] of segments) {
  for(const p of [a,b]) {
   expect(p.x).toBeGreaterThanOrEqual(0);expect(p.y).toBeGreaterThanOrEqual(0);
   expect(p.x).toBeLessThanOrEqual(4000);expect(p.y).toBeLessThanOrEqual(4000);
   const screen=imageToScreen(p,camera);
   expect(screen.x).toBeGreaterThanOrEqual(0);expect(screen.y).toBeGreaterThanOrEqual(0);
   expect(screen.x).toBeLessThanOrEqual(800);expect(screen.y).toBeLessThanOrEqual(600);
  }
  const index=a.x===b.x?(a.x-grid.originPx.x)/grid.cellSizePx:(a.y-grid.originPx.y)/grid.cellSizePx;
  expect(index).toBeCloseTo(Math.round(index));
 }
 expect(gridSegments({...grid,visible:false},4000,4000,camera,{width:800,height:600})).toEqual([]);
 expect(gridSegments(grid,4000,4000,{x:5000,y:0,zoom:1},{width:800,height:600})).toEqual([]);
});
test('мелкая сетка скрывается без изменения калибровки, неверные параметры отклоняются', () => {
 expect(gridSegments(grid,4000,4000,{x:0,y:0,zoom:0.02},{width:800,height:600})).toEqual([]);
 expect(grid.cellSizePx).toBe(80.5);
 for(const size of [0,-1,NaN,Infinity,4097]) expect(gridSchema.safeParse({...grid,cellSizePx:size}).success).toBe(false);
 expect(gridSchema.safeParse({...grid,originPx:{x:8193,y:0}}).success).toBe(false);
});
