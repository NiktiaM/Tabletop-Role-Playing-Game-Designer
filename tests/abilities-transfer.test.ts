import {expect,test} from 'vitest';
import {createCampaign,campaignSchema,parseCampaign} from '../src/shared/campaign.js';
import {abilitySchema,assignedAbilitySchema} from '../src/shared/abilities.js';
import {exportCharacter,importCharacter,checkCompatibility} from '../src/domain/transfer.js';
import {createItem} from '../src/domain/items.js';
import {characterBundleSchema} from '../src/shared/transfer.js';
function source(){
 const c=createCampaign('Источник'),id=crypto.randomUUID();
 c.characters.push({id,resources:{},name:'Герой',kind:'character',footprint:{width:2,height:1},portrait:null,values:{strength:8}});
 const definition={id:crypto.randomUUID(),revision:1,name:'Рывок',description:'Проверка',costText:'2 ОД (вручную)',maxUses:2};
 c.abilityTemplates.push(definition);c.abilities.push({id:crypto.randomUUID(),ownerId:id,definition:structuredClone(definition),usesRemaining:1});
 c.items.push({...createItem({id:crypto.randomUUID(),revision:1,name:'Меч',category:'weapon',description:'',damageDice:'1d6',maxDurability:100,maxCharges:0,image:null},id),durability:20,equipped:true});return c;
}
test('способности ограничивают использования, владельцев и дубли',()=>{
 const c=source(),a=c.abilities[0];
 expect(abilitySchema.safeParse({...a.definition,maxUses:-1}).success).toBe(false);
 expect(assignedAbilitySchema.safeParse({...a,usesRemaining:3}).success).toBe(false);
 expect(campaignSchema.safeParse({...c,abilities:[a,a]}).success).toBe(false);
 expect(campaignSchema.safeParse({...c,abilities:[{...a,ownerId:crypto.randomUUID()}]}).success).toBe(false);
 c.abilityTemplates[0].name='Новая версия';expect(a.definition.name).toBe('Рывок');
});
test('пакет переносит копию, ресурсы и снимки, не меняя исходник и правила цели',()=>{
 const src=source(),before=structuredClone(src),target=createCampaign('Цель'),pack=exportCharacter(src,src.characters[0].id);
 const result=importCharacter(target,pack),id=result.characters[0].id;
 expect(id).not.toBe(src.characters[0].id);expect(result.ruleset).toEqual(target.ruleset);expect(src).toEqual(before);expect(target.characters).toEqual([]);
 expect(result.items[0].ownerId).toBe(id);expect(result.items[0].id).not.toBe(src.items[0].id);expect(result.items[0].durability).toBe(20);expect(result.items[0].equipped).toBe(true);
 expect(result.abilities[0].ownerId).toBe(id);expect(result.abilities[0].usesRemaining).toBe(1);expect(result.tokens).toEqual([]);
 expect(parseCampaign(JSON.parse(JSON.stringify(result)))).toEqual(result);
 expect(characterBundleSchema.safeParse({...pack,items:[{...pack.items[0],ownerId:crypto.randomUUID()}]}).success).toBe(false);
});
test('несовместимость блокирует перенос, а метаданные и пробелы формулы не мешают',()=>{
 const c=source(),pack=exportCharacter(c,c.characters[0].id),target=createCampaign('Цель');
 target.ruleset.name='Другое название';target.ruleset.revision=99;checkCompatibility(target.ruleset,pack.rules);
 const firstDerived=target.ruleset.stats.find(stat=>stat.kind==='derived');if(firstDerived?.kind==='derived')firstDerived.formula=' ( constitution + level ) * 2 + armor ';
 checkCompatibility(target.ruleset,pack.rules);
 const base=target.ruleset.stats.find(stat=>stat.key==='strength');if(base?.kind==='base')base.defaultValue=6;
 expect(()=>importCharacter(target,pack)).toThrow('несовместимы');expect(target.characters).toEqual([]);
});
test('v9 получает пустые способности без изменения инвентаря',()=>{
 const c=createCampaign('Старый');const {abilities,abilityTemplates,...old}=c;
 const next=parseCampaign({...old,schemaVersion:9});expect(next.abilities).toEqual([]);expect(next.abilityTemplates).toEqual([]);expect(next.items).toEqual(c.items);expect(next.ruleset).toEqual(c.ruleset);
});
test('атомарная запись пакета сохраняет прежний файл при превышении лимита',async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {writeJsonAtomic}=await import('../src/main/storage.js');
 const dir=await mkdtemp(join(tmpdir(),'rprison-transfer-'));
 try{const path=join(dir,'character.json'),c=source(),pack=exportCharacter(c,c.characters[0].id);await writeJsonAtomic(path,pack,20*1024*1024);const before=await readFile(path,'utf8');expect(characterBundleSchema.parse(JSON.parse(before))).toEqual(pack);await expect(writeJsonAtomic(path,pack,10)).rejects.toThrow('размер');expect(await readFile(path,'utf8')).toBe(before);}finally{await rm(dir,{recursive:true,force:true});}
});
