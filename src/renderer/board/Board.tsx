import {freeHands} from '../../domain/prison-combat.js';
import {rotateToken} from '../../domain/prison-movement.js';
import {tokenSize} from '../../domain/tokens.js';
import {Fog} from './Fog.js';
import {vision,tokenVisible} from '../../domain/visibility.js';
import {battleFor,isPrison} from '../../domain/prison-state.js';
import {Visibility} from './Visibility.js';
import React, { useEffect, useRef, useState, useMemo } from 'react';
// Official CSP interpreter replaces dynamic code generation with ordinary functions.
import 'pixi.js/unsafe-eval';
import { Application, Sprite, Texture, Graphics } from 'pixi.js';
import type { Camera, GameMap, Grid, Character, Token, Campaign } from '../../shared/campaign.js';
import { gridSegments, imageToScreen, moveGrid, screenToImage, calibrateGrid, imageToCell, type Point } from '../../domain/grid.js';
import { Annotations } from './Annotations.js';
import { AnnotationTools, type AnnotationTool } from './AnnotationTools.js';
import type { Annotation } from '../../shared/annotations.js';
import {reachable,route} from '../../domain/movement.js';
import {movementBudget,movementPolicy} from '../../domain/movement-action.js';
import {MovementOverlay} from './Movement.js';
import {distanceFromDescription} from '../../domain/map-tools.js';
import {CharacterCard} from '../CharacterCard.js';
import {currentActor} from '../../domain/encounter.js';
import {GroundItems,GroundMarkers} from './GroundItems.js';
import { Tokens } from './Tokens.js';
import { fitCamera, zoomAt } from './camera.js';
export function Board({ map, camera, onCamera, onGrid, tokens, characters, placementCharacter, onPlace, onCancelPlace, onMoveToken, onRemoveToken, onAnnotations, campaign, onBudget, setupMode, onSetupMode, canUndo, onUndo, active, configure, tactical, onGroundMove, onGroundTake, inspectedId, onInspect, onResource, onValues, onAddStats, onActions,onRotate }: {onRotate:(id:string)=>void;
 onValues:(id:string,values:Record<string,number>)=>boolean;onAddStats:()=>void;onActions:(id:string)=>void;
 inspectedId:string|null;onInspect:(id:string|null)=>void;onResource:(id:string,key:string,value:number|null)=>boolean;
 onGroundMove:(id:string,column:number,row:number)=>boolean;onGroundTake:(id:string,ownerId:string|null)=>void;
 configure:boolean;tactical:boolean;active:boolean;setupMode:boolean;onSetupMode:(value:boolean)=>void;canUndo:boolean;onUndo:()=>void;
 campaign:Campaign;onBudget:(characterId:string,value:number|null)=>void;
 onAnnotations:(items:Annotation[])=>boolean;
 map:GameMap;camera?:Camera;onCamera:(camera:Camera)=>void;onGrid:(grid:Grid)=>void;
 tokens:Token[];characters:Character[];placementCharacter:Character|null;onPlace:(column:number,row:number)=>void;onCancelPlace:()=>void;
 onMoveToken:(id:string,column:number,row:number)=>void;onRemoveToken:(id:string)=>void;
}) {
  const [expanded,setExpanded]=useState(false),[drawMode,setDrawMode]=useState(true),[brushDiameter,setBrushDiameter]=useState(64),[gesture,setGesture]=useState(0),[stroke,setStroke]=useState<Point[]>([]),[drawingVisible,setDrawingVisible]=useState(false),[description,setDescription]=useState('');
  const drawing=useRef<Point[]|null>(null);
  const [annotationUndo,setAnnotationUndo]=useState<Annotation[]|null>(null);
  function changeAnnotations(items:Annotation[]){if(onAnnotations(items)){setAnnotationUndo(map.annotations);return true;}return false;}
  function pointerPoint(e:React.PointerEvent<HTMLDivElement>):Point{const bounds=e.currentTarget.getBoundingClientRect();const p=screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current!);return {x:Math.max(0,Math.min(map.width,p.x)),y:Math.max(0,Math.min(map.height,p.y))};}
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setExpanded(false);drawing.current=null;setDrawingVisible(false);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  const [placingItem,setPlacingItem]=useState<string|null>(null);
  const [povEnabled,setPovEnabled]=useState(false);
  const [movingToken,setMovingToken]=useState<string|null>(null),[preview,setPreview]=useState<{column:number;row:number}|null>(null),[budgetDraft,setBudgetDraft]=useState('');
  const cardCharacter=characters.find(character=>character.id===inspectedId);
  const selectedToken=tokens.find(token=>token.id===movingToken&&token.mapId===map.id);
  const selectedCharacter=characters.find(character=>character.id===selectedToken?.characterId);
  const movement=useMemo(()=>{try{if(!active||setupMode||!selectedToken||!selectedCharacter)return null;const policy=movementPolicy(campaign,selectedCharacter.id);if(!policy.canMove)return {error:policy.reason!};const spend=policy.spend;const budget=spend?movementBudget(campaign,selectedCharacter):{key:'',maximum:0,remaining:0};return {...budget,spend,result:reachable(map,selectedToken,characters,tokens,spend?budget.remaining:1000000,{...campaign.ruleset.movement,prison:isPrison(campaign),freeHands:freeHands(campaign,selectedCharacter.id),terrain:campaign.gameplay.terrain})};}catch(error){return {error:error instanceof Error?error.message:'Ошибка движения'};}},[selectedToken,selectedCharacter,map,characters,tokens,campaign.ruleset,campaign.gameplay,campaign.encounter,campaign.otherEncounters,campaign.session,setupMode,active,tactical]);
  const movementPath=movement&&'result' in movement&&preview?route(movement.result,preview):[];
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
  useEffect(()=>{if(placementCharacter){setPlacingItem(null);setMovingToken(null);setAnnotationTool('none');setAnnotationPoints([]);setSelectedAnnotation(null);setCalibrationMode(false);setMoveMode(false);setPoints([]);drag.current=null;}},[placementCharacter?.id]);
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
  useEffect(()=>{setPlacingItem(null);setAnnotationTool('none');setAnnotationPoints([]);setSelectedAnnotation(null);setCalibrationMode(false);setMoveMode(false);setPoints([]);drag.current=null;setMovingToken(null);setPreview(null);},[configure,tactical,active]);
  const pov=povEnabled&&!configure&&cardCharacter&&isPrison(campaign)?vision(campaign,map,cardCharacter.id):null;
  return <div className={`board-section${expanded?' editor-expanded':''}`}>
    {configure&&<div className="editor-toolbar"><button onClick={()=>setExpanded(!expanded)}>{expanded?'Закрыть большой редактор':'Развернуть редактор карты'}</button><button disabled={!annotationUndo} onClick={()=>{if(annotationUndo&&onAnnotations(annotationUndo)){setAnnotationUndo(null);setSelectedAnnotation(null);}}}>Отменить разметку</button><span>Alt + перетягивание — камера · Колесо — масштаб</span></div>}
    <details className="movement-drawer" hidden={configure}><summary>Движение</summary><section className="movement-controls" hidden={configure}><h3>Движение</h3><label className="grid-toggle"><input type="checkbox" checked={setupMode} onChange={event=>onSetupMode(event.target.checked)}/>Расстановка мастера (без пути и расхода ОД)</label><button disabled={!canUndo} onClick={onUndo}>Отменить последнее движение</button><button disabled={!selectedToken} onClick={()=>{setMovingToken(null);setPreview(null);}}>Снять выбор токена</button>{setupMode&&<p>Расстановка игнорирует стены. Проверяются только границы и занятость клеток.</p>}<p className="hint">Выберите токен. Подсветка показывает допустимые верхние левые клетки всей занимаемой области. Наведите мышь для пути, щёлкните клетку либо перетащите токен. Стены блокируют путь; жидкости замедляют, подъём расходует ОД, кислота и лава могут наносить урон.</p>
    {selectedCharacter?<><strong>{selectedCharacter.name}</strong>{movement&&'error' in movement?<p role="alert">{movement.error}</p>:movement&&'result' in movement&&<>{movement.spend&&<><p>Осталось ОД: <strong data-testid="movement-budget">{Number(movement.remaining.toFixed(3))}</strong> / {movement.maximum} · {campaign.ruleset.movement.mode==='meters'?'1 ОД/м':'1 ОД/клетку'}{movement.result.limited?' · Достигнут предел расчёта 20000 позиций':''}</p><label>Задать остаток ОД<input type="number" min="0" max={movement.maximum} step="any" value={budgetDraft} onChange={event=>setBudgetDraft(event.target.value)}/></label><button disabled={!budgetDraft.trim()||!Number.isFinite(Number(budgetDraft))||Number(budgetDraft)<0||Number(budgetDraft)>movement.maximum} onClick={()=>onBudget(selectedCharacter.id,Number(budgetDraft))}>Применить остаток ОД</button><button onClick={()=>onBudget(selectedCharacter.id,null)}>Восстановить ОД вручную</button></>}{!movement.spend&&<p>Свободное движение по путям без списания ОД.{movement.result.limited?' Достигнут предел поиска 20000 позиций.':''}</p>}{preview&&<p>Путь: {movementPath.length?(movement.spend?`${Number((movement.result.cells.get(`${preview.column},${preview.row}`)?.cost??0).toFixed(3))} ОД`:'доступен, без расхода ОД'):'недоступен'}</p>}</>}</>:<p>Токен ещё не выбран.</p>}
    </section></details>
    <div className="editor-controls" hidden={!configure}><div><AnnotationTools map={map} gesture={gesture} stroke={stroke} brushDiameter={brushDiameter} onBrushDiameter={setBrushDiameter} drawMode={drawMode} onDrawMode={setDrawMode} items={map.annotations} tool={annotationTool} onTool={tool=>{setPlacingItem(null);setAnnotationTool(tool);if(tool!=='none')setMovingToken(null);setCalibrationMode(false);setMoveMode(false);setPoints([]);drag.current=null;onCancelPlace();}} points={annotationPoints} onClear={()=>setAnnotationPoints([])} selected={selectedAnnotation} onSelect={setSelectedAnnotation} onChange={item=>changeAnnotations(map.annotations.some(existing=>existing.id===item.id)?map.annotations.map(existing=>existing.id===item.id?item:existing):[...map.annotations,item])} onDelete={id=>changeAnnotations(map.annotations.filter(item=>item.id!==id))} /></div>

    <div className="calibration-tools" hidden={!configure}>
      <button type="button" onClick={() => {setPlacingItem(null);setMovingToken(null);setAnnotationTool('none');setAnnotationPoints([]);onCancelPlace();setCalibrationMode(!calibrationMode);setMoveMode(false);setPoints([]);setCalibrationError('');drag.current=null;}}>{calibrationMode?'Отменить выбор отрезка':'Калибровать по отрезку'}</button>
      {calibrationMode && <>
        <p className="hint">Щёлкните начало и конец отрезка на карте. Укажите известную длину в метрах; масштаб клетки берётся из поля «Метров на клетку». Первую точку используем как начало сетки; её оси остаются горизонтальными и вертикальными. Выбрано точек: {points.length}/2.</p>
        <label>Описание известной длины<input aria-label="Описание масштаба" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Длина коридора 12 м"/></label><button onClick={()=>{try{setCells(String(distanceFromDescription(description)));setCalibrationError('');}catch(e){setCalibrationError(e instanceof Error?e.message:'Не удалось прочитать расстояние');}}}>Взять длину из описания</button><p className="hint">Отметьте именно описанный отрезок. По картинке без известного размера метры не определяются.</p>
        <label>Длина отрезка, м<input type="number" min="0.01" max="2048" step="any" value={cells} onChange={event => setCells(event.target.value)} /></label>
        <button type="button" disabled={points.length!==2} onClick={() => {
          try {onGrid(calibrateGrid(map.grid,points[0],points[1],Number(cells)));setCalibrationMode(false);setPoints([]);setCalibrationError('');}
          catch(error) {setCalibrationError(error instanceof Error?error.message:'Не удалось откалибровать сетку');}
        }}>Применить отрезок</button>
        <p className="hint calibration-coordinates">{points.length ? points.map((point,i)=>`${i+1}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`).join(' → ') : 'Точки ещё не выбраны'}</p>
        {calibrationError && <p role="alert">{calibrationError}</p>}
      </>}
    </div>
    <label hidden={!configure} className="grid-toggle"><input type="checkbox" checked={moveMode} onChange={event => { setPlacingItem(null);setMovingToken(null);setAnnotationTool('none');setAnnotationPoints([]);onCancelPlace();drag.current = null; setMoveMode(event.target.checked); setCalibrationMode(false);setPoints([]); if(event.target.checked && !map.grid.visible) onGrid({...map.grid,visible:true}); }} />Перемещать сетку</label>
    </div>
    {placementCharacter && <p className="placement-status" role="status">Размещение: {placementCharacter.name} ({placementCharacter.footprint.width}×{placementCharacter.footprint.height}). Щёлкните верхнюю левую клетку занимаемой области. <button onClick={onCancelPlace}>Отменить размещение</button></p>}
    <details className="ground-drawer" open={configure}><summary>Предметы на поле</summary><GroundItems campaign={campaign} map={map} placing={placingItem} onArm={id=>{setPlacingItem(id);setMovingToken(null);setPreview(null);setAnnotationTool('none');setAnnotationPoints([]);setCalibrationMode(false);setMoveMode(false);setPoints([]);drag.current=null;onCancelPlace();}} onTake={(id,ownerId)=>{setPlacingItem(null);onGroundTake(id,ownerId);}} /></details>
    <div className="board-tools">{!configure&&cardCharacter&&isPrison(campaign)&&<button aria-pressed={povEnabled} onClick={()=>setPovEnabled(!povEnabled)}>{povEnabled?'Обзор персонажа':'Обзор мастера'}</button>}<span>{map.width} × {map.height} · {Math.round((camera?.zoom ?? 1) * 100)}%</span><button disabled={!ready} onClick={() => { const e = host.current!; onCamera(fitCamera(map.width, map.height, e.clientWidth, e.clientHeight)); }}>Вписать карту</button></div>
    {map.grid.visible && map.grid.cellSizePx * (camera?.zoom ?? 1) < 6 && <p className="hint">Сетка слишком мелкая для отображения. Приблизьте карту — калибровка сохранена.</p>}
    <div className={`board-surface${cardCharacter&&!configure?' board-with-card':''}`}><div className={`board${calibrationMode || placementCharacter || placingItem || annotationTool!=='none' ? ' calibrate-grid' : moveMode ? ' move-grid' : ''}`}  ref={host} aria-label="Поле карты" onPointerDown={e => { if (e.button !== 0 || !ready) return;
      if(placingItem&&current.current&&!e.altKey){const bounds=e.currentTarget.getBoundingClientRect();const cell=imageToCell(screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current),map.grid);if(onGroundMove(placingItem,cell.column,cell.row))setPlacingItem(null);return;}
      if(!e.altKey&&annotationTool==='none'&&!placementCharacter&&!calibrationMode&&!moveMode&&selectedToken&&current.current){const bounds=e.currentTarget.getBoundingClientRect();const cell=imageToCell(screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current),map.grid);onMoveToken(selectedToken.id,cell.column,cell.row);return;}
      if(annotationTool!=='none' && current.current&&!e.altKey){
        if(annotationTool==='select'){setSelectedAnnotation(null);return;}
        const bounds=e.currentTarget.getBoundingClientRect();
        const point=screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current);
        if(point.x<0||point.y<0||point.x>map.width||point.y>map.height)return;
        if(drawMode){drawing.current=[point];setStroke([point]);setDrawingVisible(true);setAnnotationPoints([]);e.currentTarget.setPointerCapture(e.pointerId);return;}
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
      e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }} onPointerMove={e => { if(drawing.current&&current.current){const point=pointerPoint(e);let list=drawing.current;if(list.length>=512)list=list.filter((_,i)=>i%2===0);drawing.current=[...list,point];setStroke(drawing.current);return;} if(selectedToken&&current.current&&!drag.current){const bounds=e.currentTarget.getBoundingClientRect();setPreview(imageToCell(screenToImage({x:e.clientX-bounds.left-e.currentTarget.clientLeft,y:e.clientY-bounds.top-e.currentTarget.clientTop},current.current),map.grid));} if (!drag.current || !current.current) return; const before = drag.current; drag.current = { x: e.clientX, y: e.clientY }; if (moveMode) {
        const next = moveGrid(grid.current,e.clientX-before.x,e.clientY-before.y,current.current.zoom);
        grid.current = next; onGrid(next);
      } else onCamera({ ...current.current, x: current.current.x + e.clientX - before.x, y: current.current.y + e.clientY - before.y }); }} onPointerUp={e => {if(drawing.current){const list=[...drawing.current,pointerPoint(e)].slice(-512);drawing.current=null;setDrawingVisible(false);setStroke(list);const from=list[0],to=list.at(-1)!;const single=Math.hypot(to.x-from.x,to.y-from.y)<1;setAnnotationPoints(annotationTool==='light'||annotationTool==='cover'&&single?[from]:[from,to]);setGesture(value=>value+1);}drag.current = null; }} onPointerCancel={() => { drawing.current=null;setDrawingVisible(false);drag.current = null; }} onLostPointerCapture={() => {drawing.current=null;setDrawingVisible(false);drag.current = null; }}>
      {error && <p role="alert" className="board-message">{error}</p>}{!ready && !error && <p className="board-message">Загрузка карты…</p>}
      {camera&&selectedCharacter&&!setupMode&&movement&&'result' in movement&&annotationTool==='none'&&!placementCharacter&&!calibrationMode&&!moveMode&&<MovementOverlay showRange={movement.spend} result={movement.result} path={movementPath} map={map} camera={camera} character={selectedToken?{...selectedCharacter,footprint:tokenSize(selectedCharacter,selectedToken)}:selectedCharacter}/>}
      {camera&&drawingVisible&&stroke.length>0&&<svg className="gesture-preview" width="100%" height="100%"><g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>{annotationTool==='elevation'||annotationTool==='liquid'?<path d={stroke.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')+' l0.001,0'} fill="none" stroke={annotationTool==='elevation'?'#cfa2ff':'#55d9bd'} strokeWidth={brushDiameter} strokeLinecap="round" strokeLinejoin="round" opacity={.5}/>:annotationTool==='cover'?<rect x={Math.min(stroke[0].x,stroke.at(-1)!.x)} y={Math.min(stroke[0].y,stroke.at(-1)!.y)} width={Math.abs(stroke[0].x-stroke.at(-1)!.x)} height={Math.abs(stroke[0].y-stroke.at(-1)!.y)} fill="#79c5ff" opacity={.5}/>:<line x1={stroke[0].x} y1={stroke[0].y} x2={stroke.at(-1)!.x} y2={stroke.at(-1)!.y} stroke="#ffe681" strokeWidth={3/camera.zoom}/>}</g></svg>}
      {camera&&!configure&&!campaign.gameplay.ambientLight&&<Visibility map={map} camera={camera}/>}
      {camera && <Annotations items={pov?[]:map.annotations} camera={camera} width={map.width} height={map.height} selected={selectedAnnotation} onSelect={setSelectedAnnotation} selectMode={annotationTool==='select'} />}
      {annotationTool!=='none' && annotationPoints.map((point,index)=>{const screen=imageToScreen(point,camera??{x:0,y:0,zoom:1});return <span className="calibration-point" key={`annotation-${index}`} style={{left:screen.x,top:screen.y}}>{index+1}</span>;})}
      {camera&&<GroundMarkers campaign={campaign} map={map} camera={camera} disabled={!ready||!!placingItem||moveMode||calibrationMode||!!placementCharacter||annotationTool!=='none'} onMove={onGroundMove} onTake={onGroundTake}/>}
      {camera && <Tokens onRotate={onRotate} activeCharacterId={currentActor(campaign)} tokens={pov?tokens.filter(t=>t.mapId!==map.id||t.characterId===cardCharacter?.id||tokenVisible(pov,map,t)):tokens} characters={characters} map={map} camera={camera} disabled={!ready||!!placingItem||moveMode||calibrationMode||!!placementCharacter||annotationTool!=='none'} onPreview={(column,row)=>setPreview({column,row})} selectedId={movingToken} onSelect={id=>{setMovingToken(id);setPreview(null);setBudgetDraft('');if(!configure)onInspect(tokens.find(token=>token.id===id)?.characterId??null);}} onMove={onMoveToken} onRemove={onRemoveToken} />}
      {calibrationMode && points.map((point,index) => { const screen=imageToScreen(point,camera??{x:0,y:0,zoom:1});return <span className="calibration-point" key={index} style={{left:screen.x,top:screen.y}}>{index+1}</span>; })}
      {camera&&pov&&<Fog vision={pov} map={map} camera={camera}/>}
    </div>{cardCharacter&&!configure&&<CharacterCard onValues={onValues} onAddStats={onAddStats} onActions={onActions} campaign={campaign} character={cardCharacter} onResource={onResource} onClose={()=>{onInspect(null);setMovingToken(null);setPreview(null);}}/>}</div><div className="token-list">{tokens.filter(token=>token.mapId===map.id).map(token=><button key={token.id} className="secondary" onClick={()=>onRemoveToken(token.id)}>Убрать токен: {characters.find(character=>character.id===token.characterId)?.name}</button>)}</div><p className="hint">Токен: перетаскивание — привязка к клетке; стрелки — шаг; Delete — убрать с карты. Пунктир показывает занимаемую область. В игре перемещение проверяет путь; ОД расходуются только при включённом тактическом движении.</p><p className="hint">Колесо мыши — масштаб · {calibrationMode ? 'Выберите две точки на изображении' : moveMode ? 'Перетаскивание левой кнопкой — сдвиг сетки; карта остаётся на месте' : selectedToken ? 'Клик по клетке — движение; Alt + перетаскивание — камера; снять выбор — обычное панорамирование' : 'Перетаскивание левой кнопкой — перемещение карты'}</p>
  </div>;
}
