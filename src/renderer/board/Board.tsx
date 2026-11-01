import React, { useEffect, useRef, useState } from 'react';
// Official CSP interpreter replaces dynamic code generation with ordinary functions.
import 'pixi.js/unsafe-eval';
import { Application, Sprite, Texture, Graphics } from 'pixi.js';
import type { Camera, GameMap, Grid, Character, Token } from '../../shared/campaign.js';
import { gridSegments, imageToScreen, moveGrid, screenToImage, calibrateGrid, imageToCell, type Point } from '../../domain/grid.js';
import { Annotations } from './Annotations.js';
import { AnnotationTools, type AnnotationTool } from './AnnotationTools.js';
import type { Annotation } from '../../shared/annotations.js';
import { Tokens } from './Tokens.js';
import { fitCamera, zoomAt } from './camera.js';
export function Board({ map, camera, onCamera, onGrid, tokens, characters, placementCharacter, onPlace, onCancelPlace, onMoveToken, onRemoveToken, onAnnotations }: {
 onAnnotations:(items:Annotation[])=>boolean;
 map:GameMap;camera?:Camera;onCamera:(camera:Camera)=>void;onGrid:(grid:Grid)=>void;
 tokens:Token[];characters:Character[];placementCharacter:Character|null;onPlace:(column:number,row:number)=>void;onCancelPlace:()=>void;
 onMoveToken:(id:string,column:number,row:number)=>void;onRemoveToken:(id:string)=>void;
}) {
  const [annotationTool,setAnnotationTool]=useState<AnnotationTool>('none');
  const [annotationPoints,setAnnotationPoints]=useState<Point[]>([]);
  const [selectedAnnotation,setSelectedAnnotation]=useState<string|null>(null);
  const host = useRef<HTMLDivElement>(null);
  const sprite = useRef<Sprite | null>(null);
  const overlay = useRef<Graphics | null>(null);
  const grid = useRef(map.grid); grid.current = map.grid;
  const redraw = useRef<() => void>(() => undefined);
  const current = useRef(camera);
  const change = useRef(onCamera);
  current.current = camera; change.current = onCamera;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [calibrationMode,setCalibrationMode] = useState(false);
  const [points,setPoints] = useState<Point[]>([]);
  const [cells,setCells] = useState('1');
  const [calibrationError,setCalibrationError] = useState('');
  const [moveMode, setMoveMode] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(()=>{if(placementCharacter){setAnnotationTool('none');setAnnotationPoints([]);setSelectedAnnotation(null);setCalibrationMode(false);setMoveMode(false);setPoints([]);drag.current=null;}},[placementCharacter?.id]);
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
    <AnnotationTools items={map.annotations} tool={annotationTool} onTool={tool=>{setAnnotationTool(tool);setCalibrationMode(false);setMoveMode(false);setPoints([]);drag.current=null;onCancelPlace();}} points={annotationPoints} onClear={()=>setAnnotationPoints([])} selected={selectedAnnotation} onSelect={setSelectedAnnotation} onChange={item=>onAnnotations(map.annotations.some(existing=>existing.id===item.id)?map.annotations.map(existing=>existing.id===item.id?item:existing):[...map.annotations,item])} onDelete={id=>onAnnotations(map.annotations.filter(item=>item.id!==id))} />
    {placementCharacter && <p className="placement-status" role="status">Размещение: {placementCharacter.name} ({placementCharacter.footprint.width}×{placementCharacter.footprint.height}). Щёлкните верхнюю левую клетку занимаемой области. <button onClick={onCancelPlace}>Отменить размещение</button></p>}
    <div className="calibration-tools">
      <button type="button" onClick={() => {setAnnotationTool('none');setAnnotationPoints([]);onCancelPlace();setCalibrationMode(!calibrationMode);setMoveMode(false);setPoints([]);setCalibrationError('');drag.current=null;}}>{calibrationMode?'Отменить выбор отрезка':'Калибровать по отрезку'}</button>
      {calibrationMode && <>
        <p className="hint">Щёлкните начало и конец отрезка на карте. Укажите известную длину в метрах; масштаб клетки берётся из поля «Метров на клетку». Первую точку используем как начало сетки; её оси остаются горизонтальными и вертикальными. Выбрано точек: {points.length}/2.</p>
        <label>Длина отрезка, м<input type="number" min="0.01" max="2048" step="any" value={cells} onChange={event => setCells(event.target.value)} /></label>
        <button type="button" disabled={points.length!==2} onClick={() => {
          try {onGrid(calibrateGrid(map.grid,points[0],points[1],Number(cells)));setCalibrationMode(false);setPoints([]);setCalibrationError('');}
          catch(error) {setCalibrationError(error instanceof Error?error.message:'Не удалось откалибровать сетку');}
        }}>Применить отрезок</button>
        <p className="hint calibration-coordinates">{points.length ? points.map((point,i)=>`${i+1}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`).join(' → ') : 'Точки ещё не выбраны'}</p>
        {calibrationError && <p role="alert">{calibrationError}</p>}
      </>}
    </div>
    <label className="grid-toggle"><input type="checkbox" checked={moveMode} onChange={event => { setAnnotationTool('none');setAnnotationPoints([]);onCancelPlace();drag.current = null; setMoveMode(event.target.checked); setCalibrationMode(false);setPoints([]); if(event.target.checked && !map.grid.visible) onGrid({...map.grid,visible:true}); }} />Перемещать сетку</label>
    <div className="board-tools"><span>{map.width} × {map.height} · {Math.round((camera?.zoom ?? 1) * 100)}%</span><button disabled={!ready} onClick={() => { const e = host.current!; onCamera(fitCamera(map.width, map.height, e.clientWidth, e.clientHeight)); }}>Вписать карту</button></div>
    {map.grid.visible && map.grid.cellSizePx * (camera?.zoom ?? 1) < 6 && <p className="hint">Сетка слишком мелкая для отображения. Приблизьте карту — калибровка сохранена.</p>}
    <div className={`board${calibrationMode || placementCharacter || annotationTool!=='none' ? ' calibrate-grid' : moveMode ? ' move-grid' : ''}`}  ref={host} aria-label="Поле карты" onPointerDown={e => { if (e.button !== 0 || !ready) return;
      if(annotationTool!=='none' && current.current){
        if(annotationTool==='select'){setSelectedAnnotation(null);return;}
        const bounds=e.currentTarget.getBoundingClientRect();
        const point=screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current);
        if(point.x<0||point.y<0||point.x>map.width||point.y>map.height)return;
        setAnnotationPoints(previous=>previous.length>=2?[point]:[...previous,point]);return;
      }
      if(placementCharacter && current.current){
        const bounds=e.currentTarget.getBoundingClientRect();
        const point=screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current);
        const cell=imageToCell(point,map.grid);onPlace(cell.column,cell.row);return;
      }
      if (calibrationMode && current.current) {
        const bounds=e.currentTarget.getBoundingClientRect();
        const point=screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current);
        if(point.x<0||point.y<0||point.x>map.width||point.y>map.height) {setCalibrationError('Выберите точку внутри изображения.');return;}
        setCalibrationError('');setPoints(previous=>previous.length>=2?[point]:[...previous,point]);return;
      }
      e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }} onPointerMove={e => { if (!drag.current || !current.current) return; const before = drag.current; drag.current = { x: e.clientX, y: e.clientY }; if (moveMode) {
        const next = moveGrid(grid.current,e.clientX-before.x,e.clientY-before.y,current.current.zoom);
        grid.current = next; onGrid(next);
      } else onCamera({ ...current.current, x: current.current.x + e.clientX - before.x, y: current.current.y + e.clientY - before.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      {error && <p role="alert" className="board-message">{error}</p>}{!ready && !error && <p className="board-message">Загрузка карты…</p>}
      {camera && <Annotations items={map.annotations} camera={camera} width={map.width} height={map.height} selected={selectedAnnotation} onSelect={setSelectedAnnotation} selectMode={annotationTool==='select'} />}
      {annotationTool!=='none' && annotationPoints.map((point,index)=>{const screen=imageToScreen(point,camera??{x:0,y:0,zoom:1});return <span className="calibration-point" key={`annotation-${index}`} style={{left:screen.x,top:screen.y}}>{index+1}</span>;})}
      {camera && <Tokens tokens={tokens} characters={characters} map={map} camera={camera} disabled={!ready||moveMode||calibrationMode||!!placementCharacter||annotationTool!=='none'} onMove={onMoveToken} onRemove={onRemoveToken} />}
      {calibrationMode && points.map((point,index) => { const screen=imageToScreen(point,camera??{x:0,y:0,zoom:1});return <span className="calibration-point" key={index} style={{left:screen.x,top:screen.y}}>{index+1}</span>; })}
    </div><div className="token-list">{tokens.filter(token=>token.mapId===map.id).map(token=><button key={token.id} className="secondary" onClick={()=>onRemoveToken(token.id)}>Убрать токен: {characters.find(character=>character.id===token.characterId)?.name}</button>)}</div><p className="hint">Токен: перетаскивание — привязка к клетке; стрелки — шаг; Delete — убрать с карты. Пунктир показывает занимаемую область. Это ручное размещение без расчёта пути и ОД.</p><p className="hint">Колесо мыши — масштаб · {calibrationMode ? 'Выберите две точки на изображении' : moveMode ? 'Перетаскивание левой кнопкой — сдвиг сетки; карта остаётся на месте' : 'Перетаскивание левой кнопкой — перемещение карты'}</p>
  </div>;
}
