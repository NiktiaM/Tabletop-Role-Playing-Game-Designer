import { expect, test } from 'vitest';
import { fitCamera, zoomAt } from '../src/renderer/board/camera.js';
test('масштабирование сохраняет точку изображения под курсором', () => {
  const c = { x: 80, y: -30, zoom: 0.5 };
  const next = zoomAt(c, 250, 120, 2);
  expect((250-next.x)/next.zoom).toBe((250-c.x)/c.zoom);
  expect((120-next.y)/next.zoom).toBe((120-c.y)/c.zoom);
  expect(zoomAt(c,0,0,1000).zoom).toBe(8);
  expect(zoomAt(c,0,0,0.0001).zoom).toBe(0.02);
});
test('карта вписывается в окно с отступами', () => {
 const c = fitCamera(4000,2000,1000,600);
 expect(4000*c.zoom).toBeLessThanOrEqual(968);
 expect(2000*c.zoom).toBeLessThanOrEqual(568);
 expect(c.x).toBe((1000-4000*c.zoom)/2);
});
