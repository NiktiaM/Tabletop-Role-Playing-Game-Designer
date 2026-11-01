import {expect,test} from 'vitest';
import {createItem,transferItem} from '../src/domain/items.js';
import {itemTemplateSchema,itemInstanceSchema,type ItemTemplate} from '../src/shared/items.js';
import {createCampaign,campaignSchema,parseCampaign} from '../src/shared/campaign.js';
const template:ItemTemplate={image:null,id:crypto.randomUUID(),revision:1,name:'Меч',category:'weapon',description:'Тест',damageDice:'1d6',maxDurability:100,maxCharges:3};
test('экземпляры независимы, изменение шаблона не меняет старый снимок',()=>{
 const source=structuredClone(template);const a=createItem(source,null),b=createItem(source,null);
 a.durability=20;source.name='Новая версия';source.maxDurability=200;
 expect(b.durability).toBe(100);expect(a.template.name).toBe('Меч');expect(a.template.maxDurability).toBe(100);expect(a.id).not.toBe(b.id);
 expect(transferItem({...a,ownerId:crypto.randomUUID(),equipped:true},null)).toEqual({...a,ownerId:null,equipped:false});
});
test('ресурсы, кости и экипировка проверяются',()=>{
 const a=createItem(template,null);
 for(const dice of ['2d6+1','1d4','99d1000-1'])expect(itemTemplateSchema.safeParse({...template,damageDice:dice}).success).toBe(true);
 for(const dice of ['0d6','1d1','1d6;alert(1)','100d6'])expect(itemTemplateSchema.safeParse({...template,damageDice:dice}).success).toBe(false);
 expect(itemInstanceSchema.safeParse({...a,durability:101}).success).toBe(false);expect(itemInstanceSchema.safeParse({...a,charges:-1}).success).toBe(false);expect(itemInstanceSchema.safeParse({...a,equipped:true}).success).toBe(false);
});
test('ссылки владельца и уникальность проверяются, v7 получает пустой каталог',()=>{
 const c=createCampaign('Предметы');const item=createItem(template,null);
 expect(campaignSchema.safeParse({...c,itemTemplates:[template,template]}).success).toBe(false);
 expect(campaignSchema.safeParse({...c,items:[item,item]}).success).toBe(false);
 expect(campaignSchema.safeParse({...c,items:[{...item,ownerId:crypto.randomUUID()}]}).success).toBe(false);
 const {items,itemTemplates,...old}=c;const migrated=parseCampaign({...old,schemaVersion:7});expect(migrated.items).toEqual([]);expect(migrated.itemTemplates).toEqual([]);expect(migrated.ruleset).toEqual(c.ruleset);
 const next={...c,itemTemplates:[],items:[item]};expect(parseCampaign(JSON.parse(JSON.stringify(next))).items).toEqual([item]);
});
