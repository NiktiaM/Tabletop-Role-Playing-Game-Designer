import {npcExperience} from './progression.js';
import {campaignSchema,type Campaign,type Character} from '../shared/campaign.js';
import {backgroundIds,skillIds} from '../shared/prison.js';
import {health,hpChange,notice,battles} from './prison-state.js';
export const XP_LEVELS=[0,10,25,45,75,115,165,225,295,375,465,565,675,795,925,1065,1215,1375,1545,1725];
export const BACKGROUNDS=[
 {id:'gap',name:'Щель в заборе',bonuses:{dexterity:2},feature:'Преимущество раз за сцену: протискивание или выход из захвата.'},
 {id:'skin',name:'Кожа, как асфальт',bonuses:{constitution:2},feature:'Естественная броня 1, не складывается с надетой.'},
 {id:'tongue',name:'Чистая тарелка',bonuses:{charisma:2},feature:'Преимущество раз за сцену в подходящем разговоре один на один.'},
 {id:'muscle',name:'Я балонил',bonuses:{strength:2},feature:'Преимущество раз за сцену на грубую силу.'},
 {id:'nothing',name:'Забил на всё',bonuses:{strength:1,constitution:1},feature:'Преимущество против запугивания.'},
 {id:'gang',name:'Гангста с района',bonuses:{dexterity:1,charisma:1},feature:'Один согласованный контакт среди заключённых.'},
 {id:'hands',name:'Руки помнят',bonuses:{dexterity:2},feature:'Преимущество раз за сцену на ремонт или механизм.'},
 {id:'showman',name:'Бывший шоумен',bonuses:{charisma:2},feature:'+2 к следующей связанной социальной проверке одного союзника раз за сцену.'},
 {id:'veteran',name:'Контракт во Вьетнаме',bonuses:{strength:1,constitution:1},feature:'+1 к попаданию огнестрельным; знания обслуживания.'},
 {id:'gambler',name:'Карточный шулер',bonuses:{dexterity:1,charisma:1},feature:'Один переброс собственных 2d12 за игровой день, новый обязателен.'},
] as const;
export function createPrisonCharacter(input:{name:string;values:Record<string,number>;background:typeof backgroundIds[number];skill:typeof skillIds[number];footprint:Character['footprint'];portrait:string|null}):Character {
 const keys=['strength','dexterity','constitution','charisma'];
 if(keys.some(k=>!Number.isInteger(input.values[k])||input.values[k]<1)||keys.reduce((n,k)=>n+input.values[k],0)!==20)throw new Error('Распределите ровно 20 целых очков; минимум характеристики 1');
 const bg=BACKGROUNDS.find(b=>b.id===input.background);if(!bg||!skillIds.includes(input.skill))throw new Error('Выберите предысторию и стартовый навык');
 const values:Record<string,number>={...input.values,level:1,armor:0};for(const [key,n] of Object.entries(bg.bonuses))values[key]=(values[key]??0)+n;
 if(keys.some(k=>values[k]>15))throw new Error('Стартовый предел 15 с бонусом предыстории');
 return {id:crypto.randomUUID(),name:input.name,kind:'character',values,resources:{},footprint:input.footprint,portrait:input.portrait,experience:0,prisonProfile:{background:input.background,skills:[input.skill]}};
}
export const levelFromXP=(xp:number)=>Math.max(1,XP_LEVELS.filter(n=>xp>=n).length);
export function awardStoryXP(c:Campaign,key:string,label:string,amount:number,recipients:string[]):Campaign {
 if(!key.trim()||key.length>120||!label.trim()||!Number.isInteger(amount)||amount<1||amount>100000||!recipients.length||new Set(recipients).size!==recipients.length||recipients.some(id=>!c.characters.some(ch=>ch.id===id&&ch.kind==='character')))throw new Error('Укажите уникальную награду, целый XP и разных игроков');
 if(c.prison.awards.some(a=>a.key===key))throw new Error('За это достижение награда уже выдана');
 const next={...c,prison:{...c.prison,awards:[...c.prison.awards,{key,label,amount,recipients}]},characters:c.characters.map(ch=>recipients.includes(ch.id)?{...ch,experience:(ch.experience??0)+amount}:ch)};
 return campaignSchema.parse(notice(next,`${label}: каждому выбранному участнику +${amount} XP. Повышение применяется отдельно между опасными сценами.`));
}
export function levelUp(c:Campaign,id:string,key:string,skill?:typeof skillIds[number]):Campaign {
 if(battles(c).length)throw new Error('Повышайте уровень между опасными сценами');
 const ch=c.characters.find(ch=>ch.id===id);if(!ch||ch.kind!=='character'||!['strength','dexterity','constitution','charisma'].includes(key))throw new Error('Выберите персонажа и характеристику');
 const current=ch.values.level??1;if(current>=20||levelFromXP(ch.experience??0)<=current)throw new Error('Недостаточно XP для следующего уровня');
 if((ch.values[key]??5)>=20)throw new Error('Предел характеристики 20');const target=current+1,skills=ch.prisonProfile?.skills??[];
 if([5,10,15].includes(target)&&(!skill||skills.includes(skill)))throw new Error('На этом уровне выберите новый навык');
 const before=health(c,id);let next:Campaign={...c,characters:c.characters.map(row=>row.id===id?{...row,values:{...row.values,[key]:(row.values[key]??5)+1,level:target},prisonProfile:{...row.prisonProfile,skills:[...skills,...([5,10,15].includes(target)&&skill?[skill]:[])]}}:row)};
 const after=health(next,id);if(before.remaining>0)next=hpChange(next,id,after.maximum-before.maximum);
 return campaignSchema.parse(notice(next,`${ch.name}: уровень ${target}, +1 ${key}.`));
}

export function awardPrisonNPC(c:Campaign,id:string,recipients:string[]):Campaign {const npc=c.characters.find(ch=>ch.id===id&&ch.kind==='npc');if(!npc)throw new Error('ВыберитеNPC');return awardStoryXP(c,`npc:${id}`,`Преодолён ${npc.name}`,npcExperience(npc,c.ruleset),recipients);}
