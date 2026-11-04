import {Library,LibraryEntry,EmptyLibrary} from './Library.js';
import {MechanicsEditor} from './MechanicsEditor.js';
import {mechanicsSchema,defaultMechanics} from '../shared/mechanics.js';
import React,{useEffect,useState} from 'react';
import {itemTemplateSchema,itemInstanceSchema,categoryNames,type ItemTemplate,type ItemInstance} from '../shared/items.js';
import type {Campaign} from '../shared/campaign.js';
import {createItem,transferItem} from '../domain/items.js';
export function Items({campaign,onTemplates,onItems,configure=true,extras}:{extras?:React.ReactNode;campaign:Campaign;onTemplates:(templates:ItemTemplate[])=>boolean;onItems:(items:ItemInstance[])=>boolean;configure?:boolean}){
 const [notice,setNotice]=useState('');
 const [mechanics,setMechanics]=useState(defaultMechanics);
 const [editing,setEditing]=useState<ItemTemplate|null>(null),[name,setName]=useState(''),[category,setCategory]=useState<ItemTemplate['category']>('other'),[description,setDescription]=useState(''),[damage,setDamage]=useState('1d6'),[durability,setDurability]=useState('100'),[charges,setCharges]=useState('0');
 const [image,setImage]=useState<string|null>(null),[imageBusy,setImageBusy]=useState(false);
 const [owner,setOwner]=useState(''),[filter,setFilter]=useState('all'),[error,setError]=useState('');
 useEffect(()=>{if(owner&&!campaign.characters.some(character=>character.id===owner))setOwner('');if(!['all','stash'].includes(filter)&&!campaign.characters.some(character=>character.id===filter))setFilter('all');},[campaign.characters,owner,filter]);
 const [section,setSection]=useState<'templates'|'instances'>('templates'),[selected,setSelected]=useState(''),[selectedInstance,setSelectedInstance]=useState(''),[search,setSearch]=useState(''),[categoryFilter,setCategoryFilter]=useState('all'),[creating,setCreating]=useState(false),[draftDirty,setDraftDirty]=useState(false);
 function canLeave(){return !draftDirty||window.confirm('В форме есть несохранённые изменения. Закрыть черновик?');}
 function reset(){setCreating(false);setDraftDirty(false);setMechanics(defaultMechanics());setEditing(null);setImage(null);setName('');setCategory('other');setDescription('');setDamage('1d6');setDurability('100');setCharges('0');setError('');}
 function edit(template:ItemTemplate){setCreating(true);setDraftDirty(false);setMechanics(mechanicsSchema.parse(template.mechanics??{}));setEditing(template);setImage(template.image);setName(template.name);setCategory(template.category);setDescription(template.description);setDamage(template.damageDice??'1d6');setDurability(String(template.maxDurability));setCharges(String(template.maxCharges));setError('');}
 const query=search.trim().toLocaleLowerCase('ru');
 const found=(name:string,description:string)=>`${name} ${description}`.toLocaleLowerCase('ru').includes(query);
 const templates=campaign.itemTemplates.filter(t=>(categoryFilter==='all'||t.category===categoryFilter)&&found(t.name,t.description));
 const instances=campaign.items.filter(i=>(filter==='all'||filter==='stash'&&i.ownerId===null&&!i.ground||i.ownerId===filter)&&(categoryFilter==='all'||i.template.category===categoryFilter)&&found(i.template.name,i.template.description));
 const template=templates.find(t=>t.id===selected)??templates[0],instance=instances.find(i=>i.id===selectedInstance)??instances[0];
 useEffect(()=>setNotice(''),[template?.id,section]);
 return <Library detailKey={creating?`form:${editing?.id??'new'}`:section==='templates'?template?.id:instance?.id} listKey={`${section}:${search}:${categoryFilter}:${filter}`} className="items-panel" title="Предметы" count={section==='templates'?campaign.itemTemplates.length:campaign.items.length} subtitle={section==='templates'?'Каталог — описания вещей. Выберите шаблон, чтобы выдать или изменить его.':'Выданные вещи — конкретные экземпляры, их владельцы и состояние.'}
 actions={<>{extras}{configure&&<button onClick={()=>{if(canLeave()){reset();setSection('templates');setCreating(true);}}}>+ Новый предмет</button>}</>}
 tools={<><div className="library-segments" role="group" aria-label="Раздел предметов"><button aria-pressed={section==='templates'} onClick={()=>{if(canLeave()){setSection('templates');reset();}}}>Каталог</button><button aria-pressed={section==='instances'} onClick={()=>{if(canLeave()){setSection('instances');reset();}}}>Выданные вещи</button></div><label>Поиск в предметах<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Название или описание"/></label><label>Фильтр категории<select aria-label="Фильтр категории" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">Все категории</option>{Object.entries(categoryNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{section==='instances'&&<label>Показать инвентарь<select aria-label="Показать инвентарь" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все экземпляры</option><option value="stash">Общий запас</option>{campaign.characters.map(ch=><option key={ch.id} value={ch.id}>{ch.name}</option>)}</select></label>}<span className="result-count">Найдено {section==='templates'?templates.length:instances.length}</span></>}
 list={section==='templates'?<>{templates.map(t=><LibraryEntry key={t.id} id={t.id} name={t.name} image={t.image} meta={`${categoryNames[t.category]}${t.damageDice?' · '+t.damageDice:''}`} selected={!creating&&template?.id===t.id} onSelect={()=>{if(canLeave()){reset();setSelected(t.id);}}}/>)}{!templates.length&&<EmptyLibrary>Ничего не найдено. Измените поиск или создайте предмет.</EmptyLibrary>}</>:<>{instances.map(i=><LibraryEntry key={i.id} id={i.id} name={i.template.name} image={i.template.image} meta={i.ground?'На поле: '+(campaign.maps.find(m=>m.id===i.ground?.mapId)?.name??'Карта'):campaign.characters.find(ch=>ch.id===i.ownerId)?.name??'Общий запас'} selected={instance?.id===i.id} onSelect={()=>setSelectedInstance(i.id)}/>)}{!instances.length&&<EmptyLibrary>В этом разделе пока нет вещей.</EmptyLibrary>}</>}>
 {configure&&creating&&<form onChange={()=>setDraftDirty(true)} noValidate onSubmit={event=>{
  event.preventDefault();const existing=campaign.itemTemplates.find(template=>template.id===editing?.id);
  const parsed=itemTemplateSchema.safeParse({id:editing?.id??crypto.randomUUID(),revision:(existing?.revision??0)+1,mechanics,image,name,category,description,damageDice:category==='weapon'?damage:null,maxDurability:durability.trim()?Number(durability):NaN,maxCharges:charges.trim()?Number(charges):NaN});
  if(!parsed.success){setError('Введите название (1–120), описание до 2000 символов, целые максимумы 0–100000. Для оружия: кости вида 1d6 или 2d6+1 (1–99 костей, 2–1000 граней).');return;}
  const next=editing?campaign.itemTemplates.map(template=>template.id===editing.id?parsed.data:template):[...campaign.itemTemplates,parsed.data];
  if(onTemplates(next)){reset();setSelected(parsed.data.id);setSearch('');setCategoryFilter('all');}else setError('Не удалось сохранить шаблон: предел 200 шаблонов в партии.');
 }}>
 <div className="detail-heading"><div><span className="eyebrow">КАТАЛОГ ПРЕДМЕТОВ</span><h3>{editing?'Редактирование шаблона':'Новый шаблон'}</h3></div><button type="button" className="secondary" onClick={()=>{if(canLeave())reset();}}>Отменить редактирование</button></div>
 <div className="grid-fields"><label>Название предмета<input maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label>
 <label>Категория предмета<select aria-label="Категория предмета" value={category} onChange={event=>setCategory(event.target.value as ItemTemplate['category'])}>{Object.entries(categoryNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
 {category==='weapon'&&<label>Кости урона<input maxLength={20} value={damage} onChange={event=>setDamage(event.target.value)}/></label>}
 <label>Максимальная прочность<input type="number" min="0" max="100000" step="1" value={durability} onChange={event=>setDurability(event.target.value)}/></label>
 <label>Максимум зарядов<input type="number" min="0" max="100000" step="1" value={charges} onChange={event=>setCharges(event.target.value)}/></label></div>
 <label>Описание предмета<textarea maxLength={2000} value={description} onChange={event=>setDescription(event.target.value)}/></label>
 <div className="character-actions">{image&&<img className="item-photo" src={image} alt="Фото предмета"/>}<button type="button" disabled={imageBusy} onClick={async()=>{setImageBusy(true);try{const result=await window.campaigns.importPortrait();if(!result.ok)setError(result.error);else if(result.value)setImage(result.value);}catch{setError('Не удалось загрузить фотографию.');}finally{setImageBusy(false);}}}>Загрузить фото предмета…</button>{image&&<button type="button" className="secondary" onClick={()=>setImage(null)}>Убрать фото</button>}</div>
 <MechanicsEditor value={mechanics} onChange={setMechanics} campaign={campaign}/>
 <button disabled={imageBusy}>{editing?'Сохранить шаблон':'Создать шаблон'}</button>
 {error&&<p role="alert">{error}</p>}</form>}
 {section==='templates'&&!creating&&template&&<article className="template-detail-card" key={template.id}>{template.image&&<img className="item-photo" src={template.image} alt={template.name}/>}<h3>{template.name}</h3><p>{categoryNames[template.category]} · версия {template.revision}{template.damageDice?` · урон ${template.damageDice}`:''}</p><p>{template.description}</p>
 <label>Кому выдать новый экземпляр<select aria-label="Кому выдать новый экземпляр" value={owner} onChange={event=>setOwner(event.target.value)}><option value="">Общий запас</option>{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <button onClick={()=>{if(onItems([...campaign.items,createItem(template,owner||null)])){setError('');setNotice(`Выдано: ${template.name} → ${campaign.characters.find(ch=>ch.id===owner)?.name??'Общий запас'}.`);}else setError('Не удалось выдать предмет. Предел 1000 экземпляров; выберите существующего персонажа.');}}>Выдать: {template.name}</button>
 {configure&&<button className="secondary" onClick={()=>edit(template)}>Редактировать: {template.name}</button>}
 {configure&&<button className="secondary" onClick={()=>{if(window.confirm(`Удалить шаблон ${template.name}? Выданные экземпляры останутся.`)){onTemplates(campaign.itemTemplates.filter(item=>item.id!==template.id));if(editing?.id===template.id)reset();}}}>Удалить шаблон: {template.name}</button>}
 </article>}
 {section==='instances'&&instance&&<Instance key={instance.id} configure={configure} item={instance} campaign={campaign} onChange={next=>onItems(campaign.items.map(i=>i.id===next.id?next:i))} onDelete={()=>{if(window.confirm(`Удалить экземпляр ${instance.template.name}?`))onItems(campaign.items.filter(i=>i.id!==instance.id));}}/>}
 {!creating&&!(section==='templates'?template:instance)&&<EmptyLibrary><h3>{section==='templates'?'Выберите или создайте предмет':'Выданных вещей пока нет'}</h3><p>{section==='templates'?'Шаблон можно выдать персонажу или оставить в общем запасе.':'Выберите шаблон в каталоге и нажмите «Выдать».'}</p></EmptyLibrary>}
 {error&&!creating&&<p role="alert">{error}</p>}{notice&&!creating&&<p className="library-notice" role="status">{notice}</p>}
 </Library>;
}
function Instance({item,campaign,onChange,onDelete,configure}:{item:ItemInstance;campaign:Campaign;onChange:(item:ItemInstance)=>boolean;onDelete:()=>void;configure:boolean}){
 const [durability,setDurability]=useState(String(item.durability)),[charges,setCharges]=useState(String(item.charges)),[error,setError]=useState('');
 useEffect(()=>{setDurability(String(item.durability));setCharges(String(item.charges));},[item.durability,item.charges]);
 return <article className="item-instance" data-item={item.id}>{item.template.image&&<img className="item-photo" src={item.template.image} alt={item.template.name}/>}<h3>{item.template.name}</h3><p>Снимок шаблона v{item.template.revision}{item.template.damageDice?` · урон ${item.template.damageDice}`:''} · {item.id.slice(0,8)}</p>
 <label>Владелец экземпляра<select aria-label="Владелец экземпляра" value={item.ground?'ground':item.ownerId??''} onChange={event=>onChange(transferItem(item,event.target.value||null))}><option value="">Общий запас</option>{item.ground&&<option value="ground" disabled>На поле: {campaign.maps.find(map=>map.id===item.ground?.mapId)?.name} ({item.ground.column}, {item.ground.row})</option>}{campaign.characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
 <div className="grid-fields"><label>Прочность экземпляра<input type="number" min="0" max={item.template.maxDurability} step="1" value={durability} onChange={event=>setDurability(event.target.value)}/></label><span>из {item.template.maxDurability}</span>
 <label>Заряды экземпляра<input type="number" min="0" max={item.template.maxCharges} step="1" value={charges} onChange={event=>setCharges(event.target.value)}/></label><span>из {item.template.maxCharges}</span></div>
 <label className="grid-toggle"><input type="checkbox" disabled={!item.ownerId||!!item.template.maxDurability&&item.durability===0} checked={item.equipped} onChange={event=>onChange({...item,equipped:event.target.checked})}/>Экипирован</label>
 <button onClick={()=>{const result=itemInstanceSchema.safeParse({...item,durability:durability.trim()?Number(durability):NaN,charges:charges.trim()?Number(charges):NaN});if(!result.success){setError('Прочность и заряды — целые числа от нуля до максимума этого экземпляра.');return;}if(onChange(result.data))setError('');}}>Сохранить состояние</button>
 {configure&&<ItemMechanics campaign={campaign} item={item} onChange={onChange}/>}
 <button className="secondary" onClick={onDelete}>Удалить экземпляр</button>{error&&<p role="alert">{error}</p>}
 </article>;
}

function ItemMechanics({campaign,item,onChange}:{campaign:Campaign;item:ItemInstance;onChange:(item:ItemInstance)=>boolean}){
 const [value,setValue]=useState(()=>mechanicsSchema.parse(item.template.mechanics??{})),[error,setError]=useState('');
 useEffect(()=>setValue(mechanicsSchema.parse(item.template.mechanics??{})),[item.id,item.template]);
 return <details><summary>Применение этой вещи</summary><MechanicsEditor campaign={campaign} value={value} onChange={setValue}/><button onClick={()=>{const parsed=itemTemplateSchema.safeParse({...item.template,revision:item.template.revision+1,mechanics:value});if(!parsed.success){setError('Проверьте параметры применения');return;}if(onChange({...item,template:parsed.data}))setError('');}}>Сохранить применение предмета</button>{error&&<p role="alert">{error}</p>}</details>;
}
