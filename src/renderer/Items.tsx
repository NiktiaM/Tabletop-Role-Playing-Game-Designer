import React,{useEffect,useState} from 'react';
import {itemTemplateSchema,itemInstanceSchema,categoryNames,type ItemTemplate,type ItemInstance} from '../shared/items.js';
import type {Campaign} from '../shared/campaign.js';
import {createItem,transferItem} from '../domain/items.js';
export function Items({campaign,onTemplates,onItems,configure=true}:{campaign:Campaign;onTemplates:(templates:ItemTemplate[])=>boolean;onItems:(items:ItemInstance[])=>boolean;configure?:boolean}){
 const [editing,setEditing]=useState<ItemTemplate|null>(null),[name,setName]=useState(''),[category,setCategory]=useState<ItemTemplate['category']>('other'),[description,setDescription]=useState(''),[damage,setDamage]=useState('1d6'),[durability,setDurability]=useState('100'),[charges,setCharges]=useState('0');
 const [image,setImage]=useState<string|null>(null),[imageBusy,setImageBusy]=useState(false);
 const [owner,setOwner]=useState(''),[filter,setFilter]=useState('all'),[error,setError]=useState('');
 useEffect(()=>{if(owner&&!campaign.characters.some(character=>character.id===owner))setOwner('');if(!['all','stash'].includes(filter)&&!campaign.characters.some(character=>character.id===filter))setFilter('all');},[campaign.characters,owner,filter]);
 function reset(){setEditing(null);setImage(null);setName('');setCategory('other');setDescription('');setDamage('1d6');setDurability('100');setCharges('0');setError('');}
 function edit(template:ItemTemplate){setEditing(template);setImage(template.image);setName(template.name);setCategory(template.category);setDescription(template.description);setDamage(template.damageDice??'1d6');setDurability(String(template.maxDurability));setCharges(String(template.maxCharges));setError('');}
 return <section className="items-panel"><h2>Каталог предметов</h2><p>Шаблон описывает предмет. Выданные экземпляры имеют собственную прочность и заряды. Изменение шаблона не меняет уже выданные вещи.</p>
 {configure&&<form noValidate onSubmit={event=>{
  event.preventDefault();const existing=campaign.itemTemplates.find(template=>template.id===editing?.id);
  const parsed=itemTemplateSchema.safeParse({id:editing?.id??crypto.randomUUID(),revision:(existing?.revision??0)+1,image,name,category,description,damageDice:category==='weapon'?damage:null,maxDurability:durability.trim()?Number(durability):NaN,maxCharges:charges.trim()?Number(charges):NaN});
  if(!parsed.success){setError('Введите название (1–120), описание до 2000 символов, целые максимумы 0–100000. Для оружия: кости вида 1d6 или 2d6+1 (1–99 костей, 2–1000 граней).');return;}
  const next=editing?campaign.itemTemplates.map(template=>template.id===editing.id?parsed.data:template):[...campaign.itemTemplates,parsed.data];
  if(onTemplates(next))reset();else setError('Не удалось сохранить шаблон: предел 200 шаблонов в партии.');
 }}>
 <h3>{editing?'Редактирование шаблона':'Новый шаблон'}</h3>
 <div className="grid-fields"><label>Название предмета<input maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
 <label>Категория предмета<select aria-label="Категория предмета" value={category} onChange={event=>setCategory(event.target.value as ItemTemplate['category'])}>{Object.entries(categoryNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
 {category==='weapon'&&<label>Кости урона<input maxLength={20} value={damage} onChange={event=>setDamage(event.target.value)}/></label>}
 <label>Максимальная прочность<input type="number" min="0" max="100000" step="1" value={durability} onChange={event=>setDurability(event.target.value)}/></label>
 <label>Максимум зарядов<input type="number" min="0" max="100000" step="1" value={charges} onChange={event=>setCharges(event.target.value)}/></label></div>
 <label>Описание предмета<textarea maxLength={2000} value={description} onChange={event=>setDescription(event.target.value)}/></label>
 <div className="character-actions">{image&&<img className="item-photo" src={image} alt="Фото предмета"/>}<button type="button" disabled={imageBusy} onClick={async()=>{setImageBusy(true);try{const result=await window.campaigns.importPortrait();if(!result.ok)setError(result.error);else if(result.value)setImage(result.value);}catch{setError('Не удалось загрузить фотографию.');}finally{setImageBusy(false);}}}>Загрузить фото предмета…</button>{image&&<button type="button" className="secondary" onClick={()=>setImage(null)}>Убрать фото</button>}</div>
 <button disabled={imageBusy}>{editing?'Сохранить шаблон':'Создать шаблон'}</button>{editing&&<button type="button" className="secondary" onClick={reset}>Отменить редактирование</button>}
 {error&&<p role="alert">{error}</p>}</form>}
 <label>Кому выдать новый экземпляр<select aria-label="Кому выдать новый экземпляр" value={owner} onChange={event=>setOwner(event.target.value)}><option value="">Общий запас</option>{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="item-templates">{campaign.itemTemplates.map(template=><article key={template.id}>{template.image&&<img className="item-photo" src={template.image} alt={template.name}/>}<h3>{template.name}</h3><p>{categoryNames[template.category]} · версия {template.revision}{template.damageDice?` · урон ${template.damageDice}`:''}</p><p>{template.description}</p>
 <button onClick={()=>{if(onItems([...campaign.items,createItem(template,owner||null)]))setError('');else setError('Не удалось выдать предмет. Предел 1000 экземпляров; выберите существующего персонажа.');}}>Выдать: {template.name}</button>
 {configure&&<button className="secondary" onClick={()=>edit(template)}>Редактировать: {template.name}</button>}
 {configure&&<button className="secondary" onClick={()=>{if(window.confirm(`Удалить шаблон ${template.name}? Выданные экземпляры останутся.`)){onTemplates(campaign.itemTemplates.filter(item=>item.id!==template.id));if(editing?.id===template.id)reset();}}}>Удалить шаблон: {template.name}</button>}
 </article>)}</div>
 <h2>Инвентарь партии</h2><label>Показать инвентарь<select aria-label="Показать инвентарь" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Все экземпляры</option><option value="stash">Общий запас</option>{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="item-instances">{campaign.items.filter(item=>filter==='all'||filter==='stash'&&item.ownerId===null&&!item.ground||item.ownerId===filter).map(item=><Instance key={item.id} item={item} campaign={campaign} onChange={next=>onItems(campaign.items.map(existing=>existing.id===next.id?next:existing))} onDelete={()=>{if(window.confirm(`Удалить экземпляр ${item.template.name}?`))onItems(campaign.items.filter(existing=>existing.id!==item.id));}}/>)}</div>
 <p className="hint">Экипировка пока отмечается вручную и не изменяет HP, броню или урон. Кости оружия хранятся как данные, не бросаются. Нулевой максимум означает, что ресурс не используется. Общий запас хранится внутри этой партии. Чтобы оставить вещь на карте, используйте блок «Предметы на поле».</p>
 </section>;
}
function Instance({item,campaign,onChange,onDelete}:{item:ItemInstance;campaign:Campaign;onChange:(item:ItemInstance)=>boolean;onDelete:()=>void}){
 const [durability,setDurability]=useState(String(item.durability)),[charges,setCharges]=useState(String(item.charges)),[error,setError]=useState('');
 useEffect(()=>{setDurability(String(item.durability));setCharges(String(item.charges));},[item.durability,item.charges]);
 return <article className="item-instance" data-item={item.id}>{item.template.image&&<img className="item-photo" src={item.template.image} alt={item.template.name}/>}<h3>{item.template.name}</h3><p>Снимок шаблона v{item.template.revision}{item.template.damageDice?` · урон ${item.template.damageDice}`:''} · {item.id.slice(0,8)}</p>
 <label>Владелец экземпляра<select aria-label="Владелец экземпляра" value={item.ground?'ground':item.ownerId??''} onChange={event=>onChange(transferItem(item,event.target.value||null))}><option value="">Общий запас</option>{item.ground&&<option value="ground" disabled>На поле: {campaign.maps.find(map=>map.id===item.ground?.mapId)?.name} ({item.ground.column}, {item.ground.row})</option>}{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="grid-fields"><label>Прочность экземпляра<input type="number" min="0" max={item.template.maxDurability} step="1" value={durability} onChange={event=>setDurability(event.target.value)}/></label><span>из {item.template.maxDurability}</span>
 <label>Заряды экземпляра<input type="number" min="0" max={item.template.maxCharges} step="1" value={charges} onChange={event=>setCharges(event.target.value)}/></label><span>из {item.template.maxCharges}</span></div>
 <label className="grid-toggle"><input type="checkbox" disabled={!item.ownerId} checked={item.equipped} onChange={event=>onChange({...item,equipped:event.target.checked})}/>Экипирован</label>
 <button onClick={()=>{const result=itemInstanceSchema.safeParse({...item,durability:durability.trim()?Number(durability):NaN,charges:charges.trim()?Number(charges):NaN});if(!result.success){setError('Прочность и заряды — целые числа от нуля до максимума этого экземпляра.');return;}if(onChange(result.data))setError('');}}>Сохранить состояние</button>
 <button className="secondary" onClick={onDelete}>Удалить экземпляр</button>{error&&<p role="alert">{error}</p>}
 </article>;
}
