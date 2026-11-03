import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {expect,test} from 'vitest';
import {footprintFits,footprintsOverlap} from '../src/domain/tokens.js';
import {campaignSchema,defaultGrid} from '../src/shared/campaign.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('занимаемая область учитывает все клетки и неполные края карты',()=>{
 const map={width:500,height:400,grid:{...defaultGrid(),cellSizePx:50,originPx:{x:10,y:-10}}};
 expect(footprintFits(map,{column:0,row:1},{width:2,height:3})).toBe(true);
 expect(footprintFits(map,{column:0,row:0},{width:1,height:1})).toBe(false);
 expect(footprintFits(map,{column:9,row:1},{width:1,height:1})).toBe(false);
 expect(footprintFits(map,{column:8,row:1},{width:1,height:1})).toBe(true);
 expect(footprintsOverlap({column:1,row:1},{width:2,height:3},{column:3,row:1},{width:1,height:1})).toBe(false);
 expect(footprintsOverlap({column:1,row:1},{width:2,height:3},{column:2,row:3},{width:1,height:1})).toBe(true);
});
test('персонаж независим от нескольких токенов; пересечения и неверные ссылки отклоняются',()=>{
 const c=createCampaign('Токены');const mapId=crypto.randomUUID(),otherMap=crypto.randomUUID(),characterId=crypto.randomUUID();
 const map={id:mapId,name:'Карта',width:500,height:500,grid:{...defaultGrid(),cellSizePx:50},image};
 const character={id:characterId,name:'Мастер',kind:'character' as const,footprint:{width:2,height:1},portrait:null};
 const token={id:crypto.randomUUID(),mapId,characterId,column:0,row:0};
 const valid={...c,maps:[map,{...map,id:otherMap}],characters:[character],tokens:[token,{...token,id:crypto.randomUUID(),column:2},{...token,id:crypto.randomUUID(),mapId:otherMap}]};
 expect(campaignSchema.safeParse(valid).success).toBe(true);
 expect(campaignSchema.safeParse({...valid,tokens:[token,{...token,id:crypto.randomUUID(),column:1}]}).success).toBe(false);
 expect(campaignSchema.safeParse({...valid,tokens:[{...token,column:9}]}).success).toBe(false);
 expect(campaignSchema.safeParse({...valid,tokens:[{...token,characterId:crypto.randomUUID()}]}).success).toBe(false);
 expect(campaignSchema.safeParse({...valid,tokens:[{...token,mapId:crypto.randomUUID()}]}).success).toBe(false);
 expect(campaignSchema.safeParse({...valid,characters:[{...character,footprint:{width:1.5,height:1}}]}).success).toBe(false);
});
