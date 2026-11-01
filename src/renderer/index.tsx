import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Campaign, CampaignAPI, Character } from '../shared/campaign.js';
import './style.css';
import { campaignSchema } from '../shared/campaign.js';
import type { Annotation } from '../shared/annotations.js';
import {placeItem,takeItem} from '../domain/ground-items.js';
import {setResource} from '../domain/resources.js';
import {Encounter} from './Encounter.js';
import {startGame,setTacticalMovement} from '../domain/session.js';
import {moveWithPath,movementBudget} from '../domain/movement-action.js';
import {Abilities} from './Abilities.js';
import {CharacterTransfer} from './CharacterTransfer.js';
import {Inventory} from './Inventory.js';
import {ContentImport} from './ContentImport.js';
import {Items} from './Items.js';
import {transferItem} from '../domain/items.js';
import { Rules } from './Rules.js';
import { Characters } from './Characters.js';
import { GridControls } from './board/GridControls.js';
import { Board } from './board/Board.js';
import type { Camera, Grid } from '../shared/campaign.js';
declare global { interface Window { campaigns: CampaignAPI } }
function App() {
  const [inspectedId,setInspectedId]=useState<string|null>(null);
  const [screen,setScreen]=useState<'configure'|'play'>('configure');
  const [tab,setTab]=useState<'maps'|'characters'|'rules'|'items'|'inventory'|'abilities'>('maps');
  const [setupMode,setSetupMode]=useState(false),[undoMove,setUndoMove]=useState<Campaign|null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [placementId,setPlacementId]=useState<string|null>(null);
  const [name, setName] = useState('');
  useEffect(()=>setInspectedId(null),[campaign?.id]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Создайте партию или откройте сохранённый файл.');
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const canReplace = () => !dirty || window.confirm('Есть несохранённые изменения. Продолжить без сохранения?');
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch { setMessage('Нет связи с приложением. Запустите через npm run dev.'); }
    finally { setBusy(false); }
  }
  async function openParty() {
    if(!canReplace())return;
    await run(async()=>{
      const result=await window.campaigns.open();
      if(!result.ok){setMessage(result.error);return;}
      if(result.value){setCampaign(result.value.campaign);setScreen(result.value.campaign.session.started?'play':'configure');setUndoMove(null);setSetupMode(false);setDirty(false);setPlacementId(null);setTab('maps');setMessage(`Открыто: ${result.value.fileName}`);}
    });
  }
  function leaveParty() {
    if(!canReplace())return;
    setCampaign(null);setScreen('configure');setUndoMove(null);setSetupMode(false);setDirty(false);setPlacementId(null);setName('');setTab('maps');setMessage('Создайте партию или откройте сохранённый файл.');
  }
  function chooseTab(next:'maps'|'characters'|'rules'|'items'|'inventory'|'abilities') {
    setPlacementId(null);setTab(next);
  }
  function openConfigurator(){setInspectedId(null);setScreen('configure');setTab('maps');setPlacementId(null);setUndoMove(null);setSetupMode(false);}
  function openGame(){if(!campaign)return;try{if(!campaign.session.started&&!commit(startGame(campaign),'Игра начата. Сохраните партию.'))return;setScreen('play');setTab('maps');setPlacementId(null);setUndoMove(null);setSetupMode(false);}catch(error){setMessage(error instanceof Error?error.message:'Не удалось начать игру');}}
  const activeMap = campaign?.maps.find(m => m.id === campaign.view.activeMapId);
  function updateCamera(camera: Camera) {
    setCampaign(previous => {
      if (!previous || !previous.view.activeMapId) return previous;
      return { ...previous, view: { ...previous.view, cameras: { ...previous.view.cameras, [previous.view.activeMapId]: camera } } };
    });
    setDirty(true);
  }
  function commit(next: Campaign, success?: string) {
    const parsed=campaignSchema.safeParse(next);
    if(!parsed.success){setMessage(`Изменение отклонено: ${parsed.error.issues[0]?.message??'проверьте данные'}`);return false;}
    setCampaign(parsed.data);setUndoMove(null);setDirty(true);if(success)setMessage(success);return true;
  }
  function moveGroundItem(id:string,column:number,row:number){
    if(!campaign||!activeMap)return false;try{return commit(placeItem(campaign,id,activeMap.id,column,row),'Предмет размещён на поле.');}catch(error){setMessage(error instanceof Error?error.message:'Не удалось разместить предмет');return false;}
  }
  function takeGroundItem(id:string,ownerId:string|null){
    if(!campaign)return;try{commit(takeItem(campaign,id,ownerId),'Предмет передан с поля без изменения ресурсов.');}catch(error){setMessage(error instanceof Error?error.message:'Не удалось передать предмет');}
  }
  function updateGrid(grid: Grid) {
    if(campaign)commit({...campaign,maps:campaign.maps.map(map=>map.id===activeMap?.id?{...map,grid}:map)});
  }
  function updateAnnotations(annotations:Annotation[]) {
    return campaign?commit({...campaign,maps:campaign.maps.map(map=>map.id===activeMap?.id?{...map,annotations}:map)}):false;
  }
  function addCharacter(character:Character) {
    if(campaign)commit({...campaign,characters:[...campaign.characters,character]},`Создан персонаж: ${character.name}`);
  }
  function moveToken(id:string,column:number,row:number) {
    if(!campaign)return;if(screen==='configure'||setupMode){commit({...campaign,tokens:campaign.tokens.map(token=>token.id===id?{...token,column,row}:token)},'Расстановка мастера: без пути и расхода ОД.');return;}try{const moved=moveWithPath(campaign,id,column,row,campaign.session.tacticalMovement);if(moved.cost&&commit(moved.campaign,campaign.session.tacticalMovement?`Движение: ${Number(moved.cost.toFixed(3))} ОД.`:'Свободное движение: ОД не расходуются.'))setUndoMove(campaign);}catch(error){setMessage(error instanceof Error?error.message:'Движение отклонено');}
  }
  function changeResource(id:string,key:string,value:number|null){
    if(!campaign)return false;try{return commit(setResource(campaign,id,key,value),'Текущий ресурс обновлён.');}catch(error){setMessage(error instanceof Error?error.message:'Не удалось изменить ресурс');return false;}
  }
  function setBudget(id:string,value:number|null){if(campaign?.ruleset.movement.budgetStat)changeResource(id,campaign.ruleset.movement.budgetStat,value);}
  function removeToken(id:string) {if(campaign)commit({...campaign,tokens:campaign.tokens.filter(token=>token.id!==id)},'Токен убран с карты. Персонаж сохранён.');}
  const placementCharacter=campaign?.characters.find(character=>character.id===placementId)??null;
  function placeToken(column:number,row:number) {
    if(campaign&&activeMap&&placementCharacter && commit({...campaign,tokens:[...campaign.tokens,{id:crypto.randomUUID(),mapId:activeMap.id,characterId:placementCharacter.id,column,row}]},`Размещён: ${placementCharacter.name}`))setPlacementId(null);
  }
  return <main>
    {!campaign && <><header><span className="badge">R PRISON · МАСТЕРСКАЯ</span><h1>Ваши истории начинаются здесь</h1><p>Локальные партии. Ваш мир, ваши правила.</p></header>
    <section className="actions"><form onSubmit={e => { e.preventDefault(); if (!canReplace()) return; void run(async () => { const r = await window.campaigns.create(name); if (!r.ok) { setMessage(r.error); return; } setCampaign(r.value);setScreen('configure'); setTab('maps');setPlacementId(null);setDirty(true); setMessage('Партия создана. Сохраните её в файл.'); }); }}>
      <h2>Новая партия</h2><label htmlFor="name">Название партии</label><input id="name" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Например, Побег из Лейквью" required />
      <button disabled={busy || !name.trim()}>Создать партию</button>
    </form><article><h2>Продолжить историю</h2><p>Откройте сохранённую партию с этого компьютера.</p><button className="secondary" disabled={busy} onClick={()=>void openParty()}>Открыть партию…</button></article></section>
    </>}
    {campaign && <>
    <section className="current"><div><span className="badge">R PRISON · ПАРТИЯ</span><h2>{campaign.name}</h2><p>{dirty?'Есть несохранённые изменения':'Все изменения сохранены'}</p></div>
    <div className="workspace-actions"><button className="secondary" disabled={busy} onClick={leaveParty}>К выбору партии</button><button className="secondary" disabled={busy} onClick={()=>void openParty()}>Открыть партию…</button>
<button disabled={busy || !campaign} onClick={() => void run(async () => { if (!campaign) return; const r = await window.campaigns.save(campaign); if (!r.ok) { setMessage(r.error); return; } if (r.value) { setCampaign(r.value.campaign); setDirty(false); setMessage(`Сохранено: ${r.value.fileName}`); } })}>Сохранить как…</button></div></section>
    <section className="session-bar" aria-label="Режим приложения"><strong>{screen==='configure'?'Подготовка · Конфигуратор':'Проведение игры'}</strong>
    {screen==='configure'?<><button disabled={busy||!campaign.maps.length} onClick={openGame}>{campaign.session.started?'Вернуться в игру':'Начать игру'}</button>{!campaign.maps.length&&<span>Добавьте поле, чтобы начать игру.</span>}</>:<><button disabled={busy} onClick={openConfigurator}>Открыть конфигуратор</button><label className="grid-toggle"><input type="checkbox" checked={campaign.session.tacticalMovement} disabled={busy||!!campaign.encounter} onChange={event=>commit(setTacticalMovement(campaign,event.target.checked),'Режим движения изменён без сброса ОД.')}/>Тактическое движение (расход ОД)</label><span>{campaign.session.tacticalMovement?'Расход ОД включён.':'Свободная игра: путь проверяется, ОД не расходуются.'}</span></>}
    </section>
    {screen==='play'&&<div inert={busy}><Encounter key={campaign.id} campaign={campaign} onChange={commit} onCharacter={id=>{setInspectedId(id);setTab('maps');}}/></div>}
    <nav className="workspace-tabs" role="tablist" aria-label="Разделы партии">
    {([{id:'maps',name:screen==='configure'?'Карты':'Поля'},{id:'characters',name:'Персонажи'},{id:'rules',name:'Правила'},{id:'items',name:'Предметы'},{id:'inventory',name:'Инвентари'},{id:'abilities',name:'Способности'}] as const).filter(item=>screen==='configure'||item.id!=='rules').map((item,index,list)=><button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} disabled={busy} onClick={()=>chooseTab(item.id)} onKeyDown={event=>{
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=list[(index+(event.key==='ArrowRight'?1:list.length-1))%list.length].id;chooseTab(next);document.getElementById(`tab-${next}`)?.focus();}
    }}>{item.name}</button>)}
    </nav>
    <div id="panel-abilities" role="tabpanel" aria-labelledby="tab-abilities" hidden={tab!=='abilities'} inert={busy}><Abilities configure={screen==='configure'} key={campaign.id} campaign={campaign} onTemplates={abilityTemplates=>commit({...campaign,abilityTemplates},'Каталог способностей обновлён.')} onAssigned={abilities=>commit({...campaign,abilities},'Способности обновлены.')} /></div>
    <div id="panel-inventory" role="tabpanel" aria-labelledby="tab-inventory" hidden={tab!=='inventory'} inert={busy}><Inventory key={campaign.id} campaign={campaign} onItems={items=>commit({...campaign,items},'Инвентарь обновлён.')} /></div>
    <div id="panel-items" role="tabpanel" aria-labelledby="tab-items" hidden={tab!=='items'} inert={busy}><div hidden={screen!=='configure'}><ContentImport key={campaign.id} campaign={campaign} onImport={next=>commit(next,'Импорт добавлен. Сохраните партию.')} /></div><Items configure={screen==='configure'} key={campaign.id} campaign={campaign} onTemplates={itemTemplates=>commit({...campaign,itemTemplates},'Каталог обновлён.')} onItems={items=>commit({...campaign,items},'Инвентарь обновлён.')} /></div>
    <div id="panel-rules" role="tabpanel" aria-labelledby="tab-rules" hidden={tab!=='rules'||screen!=='configure'} inert={busy}><Rules key={campaign.id} rules={campaign.ruleset} characters={campaign.characters} onRules={ruleset=>commit({...campaign,ruleset},'Правила обновлены.')} onValues={(id,values)=>commit({...campaign,characters:campaign.characters.map(character=>character.id===id?{...character,values}:character)},'Значения персонажа обновлены.')} /></div>
    <div id="panel-characters" role="tabpanel" aria-labelledby="tab-characters" hidden={tab!=='characters'} inert={busy}><div hidden={screen!=='configure'}><ContentImport key={campaign.id} campaign={campaign} onImport={next=>commit(next,'Импорт добавлен. Сохраните партию.')} /></div><div hidden={screen!=='configure'}><CharacterTransfer key={`transfer-${campaign.id}`} campaign={campaign} onImport={next=>commit(next,'Персонаж перенесён. Сохраните партию.')} /></div><Characters configure={screen==='configure'} key={campaign.id} campaign={campaign} onCreate={addCharacter} onDelete={id=>{commit({...campaign,characters:campaign.characters.filter(character=>character.id!==id),tokens:campaign.tokens.filter(token=>token.characterId!==id),abilities:campaign.abilities.filter(ability=>ability.ownerId!==id),items:campaign.items.map(item=>item.ownerId===id?transferItem(item,null):item)});if(placementId===id)setPlacementId(null);}} onPlace={id=>{setTab('maps');setPlacementId(id);setMessage('Щёлкните свободную клетку на карте для размещения токена.');}} onValues={(id,values)=>commit({...campaign,characters:campaign.characters.map(character=>character.id===id?{...character,values}:character)},'Характеристики обновлены.')} onMessage={setMessage} /></div>
    <section id="panel-maps" role="tabpanel" aria-labelledby="tab-maps" hidden={tab!=='maps'} className="maps" inert={busy}><div className="maps-header"><h2>{screen==='configure'?'Карты партии':'Поля партии'}</h2><button hidden={screen!=='configure'} disabled={busy || campaign.maps.length >= 20} onClick={() => void run(async () => {
      const result = await window.campaigns.importMap();
      if (!result.ok) { setMessage(result.error); return; }
      const map = result.value;
      if (!map) return;
      setCampaign(previous => previous ? { ...previous, maps: [...previous.maps, map], view: { ...previous.view, activeMapId: map.id } } : previous);
      setDirty(true); setMessage(`Добавлена карта: ${map.name}. Сохраните партию.`);
    })}>Добавить карту…</button></div>
    <p hidden={screen!=='configure'} className="hint">До 20 карт · PNG/JPG до 15 МБ · Изображения сохраняются внутри файла партии</p>
    {campaign.maps.length > 0 ? <><label htmlFor="map-select">Текущая карта</label><select id="map-select" disabled={busy} value={campaign.view.activeMapId ?? ''} onChange={event => { const id = event.target.value; setCampaign(previous => previous ? { ...previous, view: { ...previous.view, activeMapId: id } } : previous); setDirty(true); }}>
      {campaign.maps.map(map => <option value={map.id} key={map.id}>{map.name}</option>)}
    </select>{activeMap && <React.Fragment key={activeMap.id}><div hidden={screen!=='configure'}><GridControls width={activeMap.width} height={activeMap.height} grid={activeMap.grid} onGrid={updateGrid} /></div><Board inspectedId={inspectedId} onInspect={setInspectedId} onResource={changeResource} onGroundMove={moveGroundItem} onGroundTake={takeGroundItem} configure={screen==='configure'} tactical={campaign.session.tacticalMovement} active={tab==='maps'} setupMode={screen==='configure'||setupMode} onSetupMode={setSetupMode} canUndo={!!undoMove} onUndo={()=>{if(undoMove)commit({...undoMove,view:campaign.view},'Последнее движение отменено.');}} campaign={campaign} onBudget={setBudget} key={activeMap.id} map={activeMap} camera={campaign.view.cameras[activeMap.id]} onCamera={updateCamera} onGrid={updateGrid} onAnnotations={updateAnnotations} tokens={campaign.tokens} characters={campaign.characters} placementCharacter={placementCharacter} onPlace={placeToken} onCancelPlace={()=>setPlacementId(null)} onMoveToken={moveToken} onRemoveToken={removeToken} /></React.Fragment>}</> : <p>Добавьте первую карту, чтобы открыть игровой стол.</p>}
    </section></>}
    <p role="status" aria-live="polite" className="status">{busy ? 'Выполняется операция…' : message}</p><footer>Подготовка и проведение игры · Данные остаются на вашем компьютере</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
