import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Campaign, CampaignAPI, Character } from '../shared/campaign.js';
import './style.css';
import { campaignSchema } from '../shared/campaign.js';
import type { Annotation } from '../shared/annotations.js';
import { Characters } from './Characters.js';
import { GridControls } from './board/GridControls.js';
import { Board } from './board/Board.js';
import type { Camera, Grid } from '../shared/campaign.js';
declare global { interface Window { campaigns: CampaignAPI } }
function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [placementId,setPlacementId]=useState<string|null>(null);
  const [name, setName] = useState('');
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
    if(!parsed.success){setMessage('Изменение отклонено: проверьте свободные клетки и границы карты. Предел: 200 персонажей и 500 токенов.');return false;}
    setCampaign(parsed.data);setDirty(true);if(success)setMessage(success);return true;
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
    if(campaign)commit({...campaign,tokens:campaign.tokens.map(token=>token.id===id?{...token,column,row}:token)},'Токен перемещён.');
  }
  function removeToken(id:string) {if(campaign)commit({...campaign,tokens:campaign.tokens.filter(token=>token.id!==id)},'Токен убран с карты. Персонаж сохранён.');}
  const placementCharacter=campaign?.characters.find(character=>character.id===placementId)??null;
  function placeToken(column:number,row:number) {
    if(campaign&&activeMap&&placementCharacter && commit({...campaign,tokens:[...campaign.tokens,{id:crypto.randomUUID(),mapId:activeMap.id,characterId:placementCharacter.id,column,row}]},`Размещён: ${placementCharacter.name}`))setPlacementId(null);
  }
  return <main>
    <header><span className="badge">R PRISON · МАСТЕРСКАЯ</span><h1>Ваши истории начинаются здесь</h1><p>Локальные партии. Ваш мир, ваши правила.</p></header>
    <section className="actions"><form onSubmit={e => { e.preventDefault(); if (!canReplace()) return; void run(async () => { const r = await window.campaigns.create(name); if (!r.ok) { setMessage(r.error); return; } setCampaign(r.value); setDirty(true); setMessage('Партия создана. Сохраните её в файл.'); }); }}>
      <h2>Новая партия</h2><label htmlFor="name">Название партии</label><input id="name" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Например, Побег из Лейквью" required />
      <button disabled={busy || !name.trim()}>Создать партию</button>
    </form><article><h2>Продолжить историю</h2><p>Откройте сохранённую партию с этого компьютера.</p><button className="secondary" disabled={busy} onClick={() => { if (!canReplace()) return; void run(async () => { const r = await window.campaigns.open(); if (!r.ok) { setMessage(r.error); return; } if (r.value) { setCampaign(r.value.campaign); setDirty(false); setMessage(`Открыто: ${r.value.fileName}`); } }); }}>Открыть партию…</button></article></section>
    <section className="current"><div><span className="badge">ТЕКУЩАЯ ПАРТИЯ</span><h2>{campaign?.name ?? 'Партия не выбрана'}</h2><p>{campaign ? (dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены') : 'Карты, персонажи и игровой стол появятся в следующих итерациях.'}</p></div><button disabled={busy || !campaign} onClick={() => void run(async () => { if (!campaign) return; const r = await window.campaigns.save(campaign); if (!r.ok) { setMessage(r.error); return; } if (r.value) { setCampaign(r.value.campaign); setDirty(false); setMessage(`Сохранено: ${r.value.fileName}`); } })}>Сохранить как…</button></section>
    {campaign && <div inert={busy}><Characters key={campaign.id} campaign={campaign} onCreate={addCharacter} onDelete={id=>{commit({...campaign,characters:campaign.characters.filter(character=>character.id!==id),tokens:campaign.tokens.filter(token=>token.characterId!==id)});if(placementId===id)setPlacementId(null);}} onPlace={id=>{setPlacementId(id);setMessage('Щёлкните свободную клетку на карте для размещения токена.');}} onMessage={setMessage} /></div>}
    {campaign && <section className="maps" inert={busy}><div className="maps-header"><h2>Карты партии</h2><button disabled={busy || campaign.maps.length >= 20} onClick={() => void run(async () => {
      const result = await window.campaigns.importMap();
      if (!result.ok) { setMessage(result.error); return; }
      const map = result.value;
      if (!map) return;
      setCampaign(previous => previous ? { ...previous, maps: [...previous.maps, map], view: { ...previous.view, activeMapId: map.id } } : previous);
      setDirty(true); setMessage(`Добавлена карта: ${map.name}. Сохраните партию.`);
    })}>Добавить карту…</button></div>
    <p className="hint">До 20 карт · PNG/JPG до 15 МБ · Изображения сохраняются внутри файла партии</p>
    {campaign.maps.length > 0 ? <><label htmlFor="map-select">Текущая карта</label><select id="map-select" disabled={busy} value={campaign.view.activeMapId ?? ''} onChange={event => { const id = event.target.value; setCampaign(previous => previous ? { ...previous, view: { ...previous.view, activeMapId: id } } : previous); setDirty(true); }}>
      {campaign.maps.map(map => <option value={map.id} key={map.id}>{map.name}</option>)}
    </select>{activeMap && <React.Fragment key={activeMap.id}><GridControls width={activeMap.width} height={activeMap.height} grid={activeMap.grid} onGrid={updateGrid} /><Board key={activeMap.id} map={activeMap} camera={campaign.view.cameras[activeMap.id]} onCamera={updateCamera} onGrid={updateGrid} onAnnotations={updateAnnotations} tokens={campaign.tokens} characters={campaign.characters} placementCharacter={placementCharacter} onPlace={placeToken} onCancelPlace={()=>setPlacementId(null)} onMoveToken={moveToken} onRemoveToken={removeToken} /></React.Fragment>}</> : <p>Добавьте первую карту, чтобы открыть игровой стол.</p>}
    </section>}
    <p role="status" aria-live="polite" className="status">{busy ? 'Выполняется операция…' : message}</p><footer>Итерация 6 · Данные остаются на вашем компьютере</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
