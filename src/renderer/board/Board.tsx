import React, { useEffect, useRef, useState } from 'react';
// Official CSP interpreter replaces dynamic code generation with ordinary functions.
import 'pixi.js/unsafe-eval';
import { Application, Sprite, Texture, Graphics } from 'pixi.js';
import type { Camera, GameMap } from '../../shared/campaign.js';
import { gridSegments, imageToScreen } from '../../domain/grid.js';
import { fitCamera, zoomAt } from './camera.js';
export function Board({ map, camera, onCamera }: { map: GameMap; camera?: Camera; onCamera: (camera: Camera) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const sprite = useRef<Sprite | null>(null);
  const overlay = useRef<Graphics | null>(null);
  const grid = useRef(map.grid); grid.current = map.grid;
  const redraw = useRef<() => void>(() => undefined);
  const current = useRef(camera);
  const change = useRef(onCamera);
  current.current = camera; change.current = onCamera;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = host.current!;
    const app = new Application();
    let disposed = false; let initialized = false; let texture: Texture | null = null;
    let resize: ResizeObserver | undefined;
    setError(''); setReady(false);
    const image = new Image();
    async function start() {
      try {
        image.src = map.image; await image.decode();
        if (disposed) return;
        await app.init({ width: element.clientWidth, height: element.clientHeight, background: '#0d1118', preference: 'webgl', antialias: true });
        initialized = true;
        if (disposed) { app.destroy(true); return; }
        texture = Texture.from(image);
        const view = new Sprite(texture); sprite.current = view; app.stage.addChild(view);
        const lines = new Graphics(); overlay.current = lines; app.stage.addChild(lines);
        redraw.current = () => {
          lines.clear();
          const camera = current.current; if (!camera) return;
          const segments = gridSegments(grid.current, map.width, map.height, camera, {width:element.clientWidth,height:element.clientHeight});
          for (const [from,to] of segments) {
            const a=imageToScreen(from,camera), b=imageToScreen(to,camera);
            lines.moveTo(a.x,a.y).lineTo(b.x,b.y);
          }
          if (segments.length) lines.stroke({color:0xffffff,alpha:0.6,width:1});
        };
        element.appendChild(app.canvas);
        const initial = current.current ?? fitCamera(map.width, map.height, element.clientWidth, element.clientHeight);
        if (!current.current) change.current(initial);
        current.current = initial;
        view.position.set(initial.x, initial.y); view.scale.set(initial.zoom);
        redraw.current();
        resize = new ResizeObserver(() => { app.renderer.resize(element.clientWidth, element.clientHeight); redraw.current(); });
        resize.observe(element); setReady(true);
      } catch (error) { console.error(error); if (!disposed) setError('Не удалось отобразить карту. Проверьте поддержку WebGL и размер изображения.'); }
    }
    void start();
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); if (!current.current) return;
      const bounds = element.getBoundingClientRect();
      change.current(zoomAt(current.current, event.clientX - bounds.left, event.clientY - bounds.top, Math.exp(-event.deltaY * 0.001)));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { disposed = true; resize?.disconnect(); element.removeEventListener('wheel', wheel); sprite.current = null; overlay.current = null; redraw.current = () => undefined; if (initialized) { app.destroy(true, { children: true }); texture?.destroy(true); } };
  }, [map.id, map.image, map.width, map.height]);
  useEffect(() => { if (sprite.current && camera) { sprite.current.position.set(camera.x, camera.y); sprite.current.scale.set(camera.zoom); } redraw.current(); }, [camera, map.grid]);
  return <div className="board-section">
    <div className="board-tools"><span>{map.width} × {map.height} · {Math.round((camera?.zoom ?? 1) * 100)}%</span><button disabled={!ready} onClick={() => { const e = host.current!; onCamera(fitCamera(map.width, map.height, e.clientWidth, e.clientHeight)); }}>Вписать карту</button></div>
    {map.grid.visible && map.grid.cellSizePx * (camera?.zoom ?? 1) < 6 && <p className="hint">Сетка слишком мелкая для отображения. Приблизьте карту — калибровка сохранена.</p>}
    <div className="board" ref={host} aria-label="Поле карты" onPointerDown={e => { if (e.button !== 0 || !ready) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }} onPointerMove={e => { if (!drag.current || !current.current) return; const before = drag.current; drag.current = { x: e.clientX, y: e.clientY }; onCamera({ ...current.current, x: current.current.x + e.clientX - before.x, y: current.current.y + e.clientY - before.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      {error && <p role="alert" className="board-message">{error}</p>}{!ready && !error && <p className="board-message">Загрузка карты…</p>}
    </div><p className="hint">Колесо мыши — масштаб · Перетаскивание левой кнопкой — перемещение карты</p>
  </div>;
}
