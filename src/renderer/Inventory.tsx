import React,{useEffect,useState,useRef} from 'react';
import type {Campaign} from '../shared/campaign.js';
import type {ItemInstance} from '../shared/items.js';
import {categoryNames} from '../shared/items.js';
import {giveInventory} from '../domain/inventory.js';
const mime='application/x-rprison-item';
export function Inventory({campaign,onItems}:{campaign:Campaign;onItems:(items:ItemInstance[])=>boolean}){
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[source,setSource]=useState('templates'),[message,setMessage]=useState('');
 useEffect(()=>{if(selected&&!campaign.characters.some(character=>character.id===selected))setSelected('');},[campaign.characters,selected]);
 const owners=useRef<HTMLDivElement>(null);
 useEffect(()=>{owners.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[selected]);
 const activeOwner=selected||(!campaign.gameplay.sharedStashEnabled?campaign.characters[0]?.id??'':''),character=campaign.characters.find(character=>character.id===activeOwner),owner=activeOwner||null;
 const owned=campaign.items.filter(item=>!item.ground&&item.ownerId===owner);
 function give(payload:unknown){try{if(onItems(giveInventory(campaign,payload,owner)))setMessage('Предмет добавлен в выбранный инвентарь. Сохраните партию.');}catch(error){setMessage(error instanceof Error?error.message:'Не удалось перенести предмет');}}
 function drag(event:React.DragEvent,kind:'template'|'instance',id:string){event.dataTransfer.setData(mime,JSON.stringify({kind,id}));event.dataTransfer.effectAllowed=kind==='template'?'copy':'move';}
 const query=search.trim().toLocaleLowerCase('ru');
 const found=(name:string,description:string)=>`${name} ${description}`.toLocaleLowerCase('ru').includes(query);
 return <section className="inventory-panel"><div className="inventory-heading"><h2>Инвентари персонажей и NPC</h2><label>Быстрый выбор инвентаря<select aria-label="Быстрый выбор инвентаря" value={activeOwner} onChange={e=>{setSelected(e.target.value);setMessage('');}}>{campaign.gameplay.sharedStashEnabled&&<option value="">Общий запас</option>}{campaign.characters.map(ch=><option key={ch.id} value={ch.id}>{ch.name}</option>)}</select></label></div>
 <div ref={owners} className="inventory-owners" role="group" aria-label="Выбор владельца инвентаря">{campaign.gameplay.sharedStashEnabled&&<button aria-label="Общий запас" aria-pressed={!selected} onClick={()=>{setSelected('');setMessage('');}}><span className="owner-initial">▣</span><span className="owner-name">Общий запас</span></button>}
 {campaign.characters.map(character=><button key={character.id} aria-label={`${character.name} ${character.kind==='npc'?'NPC':'Персонаж'}`} aria-pressed={activeOwner===character.id} onClick={()=>{setSelected(character.id);setMessage('');}}>{character.portrait?<img src={character.portrait} alt=""/>:<span className="owner-initial">{character.name.slice(0,1)}</span>}<span className="owner-name">{character.name}</span><small>{character.kind==='npc'?'NPC':'Персонаж'}</small></button>)}</div>
 <div className="inventory-workspace"><div className="inventory-drop" data-testid="inventory-drop" onDragOver={event=>{if(event.dataTransfer.types.includes(mime))event.preventDefault();}} onDrop={event=>{event.preventDefault();const raw=event.dataTransfer.getData(mime);if(!raw){setMessage('Перетаскивайте предметы из списка ниже.');return;}try{give(JSON.parse(raw) as unknown);}catch{setMessage('Не удалось прочитать данные перетаскивания.');}}}>
 <h3>Инвентарь: {character?.name??(campaign.gameplay.sharedStashEnabled?'Общий запас':'Выберите персонажа')}</h3><p className="hint">Перетащите сюда предмет из соседнего списка или используйте его кнопку «Добавить в инвентарь».</p>
 <div className="inventory-cards">{owned.map(item=><article key={item.id} data-inventory-item={item.id}>
 {item.template.image&&<img className="item-photo" src={item.template.image} alt={item.template.name}/>}<strong>{item.template.name}</strong><span>Прочность {item.durability}/{item.template.maxDurability} · заряды {item.charges}/{item.template.maxCharges}{item.equipped?' · экипирован':''}</span>
 {owner!==null&&campaign.gameplay.sharedStashEnabled&&<button className="secondary" onClick={()=>onItems(campaign.items.map(existing=>existing.id===item.id?{...existing,ownerId:null,equipped:false}:existing))}>В запас: {item.template.name}</button>}
 </article>)}</div>{!owned.length&&<p>Пока пусто.</p>}
 </div><section className="inventory-source-panel"><h3>Добавить или передать вещь</h3><p role="status">{message}</p><div className="grid-fields"><label>Поиск предметов<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Название или описание"/></label><label>Источник предметов<select aria-label="Источник предметов" value={source} onChange={event=>setSource(event.target.value)}><option value="templates">Шаблоны — создать экземпляр</option>{campaign.gameplay.sharedStashEnabled&&<option value="stash">Вещи в общем запасе</option>}<option value="instances">Вещи других персонажей и запас</option></select></label></div>
 <details className="inventory-help"><summary>Как передавать вещи</summary><p className="hint">Перетаскивание шаблона создаёт новую вещь. Перетаскивание существующей вещи меняет владельца, сохраняя прочность и заряды; отметка экипировки снимается. Экипировка и изменение ресурсов доступны во вкладке «Предметы».</p></details>
 <div className="inventory-cards" data-testid="inventory-source">{source==='templates'?campaign.itemTemplates.filter(item=>found(item.name,item.description)).map(template=><article key={template.id} draggable onDragStart={event=>drag(event,'template',template.id)} data-source-template={template.id}>
 {template.image&&<img className="item-photo" src={template.image} alt={template.name}/>}<strong>{template.name}</strong><span>{categoryNames[template.category]} · шаблон v{template.revision}</span><button disabled={!owner&&!campaign.gameplay.sharedStashEnabled} onClick={()=>give({kind:'template',id:template.id})}>Добавить в инвентарь: {template.name}</button>
 </article>):campaign.items.filter(item=>!item.ground&&item.ownerId!==owner&&(source!=='stash'||item.ownerId===null)&&found(item.template.name,item.template.description)).map(item=><article key={item.id} draggable onDragStart={event=>drag(event,'instance',item.id)} data-source-instance={item.id}>
 {item.template.image&&<img className="item-photo" src={item.template.image} alt={item.template.name}/>}<strong>{item.template.name}</strong><span>{campaign.characters.find(character=>character.id===item.ownerId)?.name??(campaign.gameplay.sharedStashEnabled?'Общий запас':'Без владельца')} · прочность {item.durability}/{item.template.maxDurability}</span><button disabled={!owner&&!campaign.gameplay.sharedStashEnabled} onClick={()=>give({kind:'instance',id:item.id})}>Добавить в инвентарь: {item.template.name}</button>
 </article>)}</div>
 </section></div></section>;
}
