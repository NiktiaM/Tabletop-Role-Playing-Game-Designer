import {health,condition} from './prison-state.js';
import {carrySummary} from './prison-inventory.js';
import {itemTemplateSchema,type ItemTemplate} from '../shared/items.js';
import {type Mechanics} from '../shared/mechanics.js';
import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {createItem} from './items.js';
import {notice,battleFor,advanceTime} from './prison-state.js';
import type {recipeIds} from '../shared/prison.js';
export {catalogId,prisonCatalog} from './prison-catalog-data.js';
import {catalogId,prisonCatalog} from './prison-catalog-data.js';
export interface Recipe {id:typeof recipeIds[number];name:string;minutes:number;needs:Record<string,number>;tools:boolean;output:number|null;retain?:string[]}
export const RECIPES:Recipe[]=[
 {id:'bandage',name:'Повязка',minutes:2,needs:{cloth:1},tools:false,output:9},
 {id:'kit',name:'Импровизированная аптечка',minutes:5,needs:{bandage:1,medical:1},tools:false,output:10},
 {id:'bag',name:'Мешок',minutes:10,needs:{cloth:1,strap:1},tools:false,output:13},
 {id:'carry',name:'Петля для переноски',minutes:5,needs:{strap:1},tools:false,output:14},
 {id:'map',name:'Схема маршрута',minutes:5,needs:{paper:1,pencil:1},tools:false,output:15,retain:['pencil']},
 {id:'clothes',name:'Подгонка одежды',minutes:5,needs:{clothes:1},tools:true,output:16},
 {id:'lightClub',name:'Лёгкое дробящее',minutes:5,needs:{wood:1},tools:false,output:1},
 {id:'club',name:'Обычное дробящее',minutes:10,needs:{wood:1},tools:true,output:2},
 {id:'shiv',name:'Заточка',minutes:15,needs:{metal:1,cloth:1},tools:true,output:3},
 {id:'locktool',name:'Средство для простого замка',minutes:15,needs:{metal:1,wire:1},tools:true,output:17},
 {id:'ladder',name:'Короткая лестница',minutes:30,needs:{rail:2,rung:3,fastener:1},tools:true,output:18},
 {id:'repair',name:'Простой ремонт',minutes:5,needs:{metal:1},tools:true,output:null},
];
export function installCatalog(c:Campaign):Campaign {const ids=new Set(c.itemTemplates.map(t=>t.id));return campaignSchema.parse(notice({...c,itemTemplates:[...c.itemTemplates,...prisonCatalog().filter(t=>!ids.has(t.id))]},'Каталог Prison 0.3 добавлен. Существующие экземпляры не изменены.'));}
export function startCraft(c:Campaign,ownerId:string,recipeId:Recipe['id'],materials:string[],toolsAvailable:boolean,repairItemId?:string):Campaign {
 const recipe=RECIPES.find(r=>r.id===recipeId);if(!recipe||!c.characters.some(ch=>ch.id===ownerId))throw new Error('Выберите рецепт и персонажа');
 if(health(c,ownerId).remaining<=0||condition(c,ownerId).hospitalUntil!==null)throw new Error('Нет возможности работать в этом состоянии');
 if(battleFor(c,ownerId))throw new Error('Длительный крафт выполняется вне боя');if(c.prison.projects.some(p=>p.ownerId===ownerId&&p.active))throw new Error('У персонажа уже идёт работа');
 if(recipe.tools&&!toolsAvailable)throw new Error('Подтвердите доступ к подходящему месту и инструментам');
 if(new Set(materials).size!==materials.length)throw new Error('Один компонент нельзя использовать дважды');
 const selected=materials.map(id=>c.items.find(i=>i.id===id&&i.ownerId===ownerId&&(!i.template.maxDurability||i.durability>0)));
 if(selected.some(i=>!i))throw new Error('Материалы должны находиться в инвентаре');
 const counts:Record<string,number>={};for(const item of selected){const tag=item!.template.mechanics?.materialTag??'';counts[tag]=(counts[tag]??0)+1;}
 if(Object.entries(recipe.needs).some(([tag,n])=>counts[tag]!==n)||Object.keys(counts).some(tag=>!Object.hasOwn(recipe.needs,tag)))throw new Error('Выберите ровно компоненты рецепта');
 if(recipe.id==='repair'&&!c.items.some(i=>i.id===repairItemId&&i.ownerId===ownerId&&i.template.maxDurability>i.durability))throw new Error('Выберите ремонтопригодную повреждённую вещь');
 const consume=new Set(selected.filter(i=>!recipe.retain?.includes(i!.template.mechanics?.materialTag??'')).map(i=>i!.id));
 return campaignSchema.parse(notice({...c,items:c.items.filter(i=>!consume.has(i.id)),prison:{...c.prison,projects:[...c.prison.projects,{id:crypto.randomUUID(),ownerId,recipeId,active:true,remainingSeconds:recipe.minutes*60,...(repairItemId?{repairItemId}:{})}]}},`Начат крафт: ${recipe.name}. Материалы списаны, время ${recipe.minutes} игровых минут.`));
}
export function setProjectActive(c:Campaign,id:string,active:boolean):Campaign {const p=c.prison.projects.find(p=>p.id===id);if(!p)throw new Error('Проект не найден');if(active&&(battleFor(c,p.ownerId)||c.prison.projects.some(other=>other.id!==id&&other.ownerId===p.ownerId&&other.active)))throw new Error('Сначала завершите бой или приостановите другую работу');return {...c,prison:{...c.prison,projects:c.prison.projects.map(p=>p.id===id?{...p,active}:p)}};}
export function advanceCraftTime(c:Campaign,seconds:number):Campaign {
 let next=advanceTime(c,seconds);const completed:string[]=[];
 for(const p of c.prison.projects){if(!p.active||battleFor(c,p.ownerId)||health(c,p.ownerId).remaining<=0||condition(c,p.ownerId).hospitalUntil!==null)continue;const left=Math.max(0,p.remainingSeconds-seconds);next={...next,prison:{...next.prison,projects:next.prison.projects.map(row=>row.id===p.id?{...row,remainingSeconds:left}:row)}};if(left)continue;
 const recipe=RECIPES.find(r=>r.id===p.recipeId)!;
 if(recipe.output!==null){const template=prisonCatalog().find(t=>t.id===catalogId(recipe.output!))!;const result=createItem(template,p.ownerId);next={...next,items:[...next.items,result]};if(!carrySummary(next,p.ownerId).valid){const token=next.tokens.find(t=>t.characterId===p.ownerId);next={...next,items:next.items.map(i=>i.id===result.id?{...i,ownerId:null,ground:token?{mapId:token.mapId,column:token.column,row:token.row}:null}:i)};next=notice(next,'Готовая вещь не помещается: оставлена у персонажа на поле или в общем запасе.');}}
 else next={...next,items:next.items.map(i=>i.id===p.repairItemId?{...i,durability:i.template.maxDurability}:i)};
 completed.push(p.id);next=notice(next,`Готово: ${recipe.name}.`);
 }
 next={...next,prison:{...next.prison,projects:next.prison.projects.filter(p=>!completed.includes(p.id))}};
 return campaignSchema.parse(next);
}
