import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Campaign, CampaignAPI } from '../shared/campaign.js';
import './style.css';
declare global { interface Window { campaigns: CampaignAPI } }
function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
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
  return <main>
    <header><span className="badge">R PRISON · МАСТЕРСКАЯ</span><h1>Ваши истории начинаются здесь</h1><p>Локальные партии. Ваш мир, ваши правила.</p></header>
    <section className="actions"><form onSubmit={e => { e.preventDefault(); if (!canReplace()) return; void run(async () => { const r = await window.campaigns.create(name); if (!r.ok) { setMessage(r.error); return; } setCampaign(r.value); setDirty(true); setMessage('Партия создана. Сохраните её в файл.'); }); }}>
      <h2>Новая партия</h2><label htmlFor="name">Название партии</label><input id="name" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Например, Побег из Лейквью" required />
      <button disabled={busy || !name.trim()}>Создать партию</button>
    </form><article><h2>Продолжить историю</h2><p>Откройте сохранённую партию с этого компьютера.</p><button className="secondary" disabled={busy} onClick={() => { if (!canReplace()) return; void run(async () => { const r = await window.campaigns.open(); if (!r.ok) { setMessage(r.error); return; } if (r.value) { setCampaign(r.value.campaign); setDirty(false); setMessage(`Открыто: ${r.value.fileName}`); } }); }}>Открыть партию…</button></article></section>
    <section className="current"><div><span className="badge">ТЕКУЩАЯ ПАРТИЯ</span><h2>{campaign?.name ?? 'Партия не выбрана'}</h2><p>{campaign ? (dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены') : 'Карты, персонажи и игровой стол появятся в следующих итерациях.'}</p></div><button disabled={busy || !campaign} onClick={() => void run(async () => { if (!campaign) return; const r = await window.campaigns.save(campaign); if (!r.ok) { setMessage(r.error); return; } if (r.value) { setCampaign(r.value.campaign); setDirty(false); setMessage(`Сохранено: ${r.value.fileName}`); } })}>Сохранить как…</button></section>
    <p role="status" aria-live="polite" className="status">{busy ? 'Выполняется операция…' : message}</p><footer>Итерация 1 · Данные остаются на вашем компьютере</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
