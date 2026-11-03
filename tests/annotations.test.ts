import {legacyCampaign as createCampaign} from './legacy-fixture.js';
import {expect,test} from 'vitest';
import {annotationSchema} from '../src/shared/annotations.js';
import {mapSchema,defaultGrid,parseCampaign} from '../src/shared/campaign.js';
const base={id:crypto.randomUUID(),name:'Разметка',visible:true};
const wall={...base,kind:'wall' as const,from:{x:10,y:20},to:{x:90,y:70},destructible:true,hp:10};
const map={id:crypto.randomUUID(),name:'Карта',width:100,height:100,grid:defaultGrid(),image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',annotations:[wall]};
test('все виды разметки валидируются, вырожденные фигуры и неверные параметры отклоняются',()=>{
 expect(annotationSchema.safeParse(wall).success).toBe(true);
 expect(annotationSchema.safeParse({...wall,to:wall.from}).success).toBe(false);
 expect(annotationSchema.safeParse({...wall,hp:0}).success).toBe(false);
 expect(annotationSchema.safeParse({...wall,from:{x:NaN,y:1}}).success).toBe(false);
 expect(annotationSchema.safeParse({...base,kind:'cover',from:{x:90,y:90},to:{x:10,y:10},level:'medium'}).success).toBe(true);
 expect(annotationSchema.safeParse({...base,kind:'elevation',from:{x:0,y:0},to:{x:20,y:0},heightMeters:2}).success).toBe(false);
 expect(annotationSchema.safeParse({...base,kind:'liquid',from:{x:0,y:0},to:{x:20,y:20},liquidType:'acid'}).success).toBe(true);
 expect(annotationSchema.safeParse({...base,kind:'light',center:{x:50,y:50},radius:0}).success).toBe(false);
});
test('разметка проверяется относительно своей карты, радиус света может выходить за край',()=>{
 expect(mapSchema.safeParse(map).success).toBe(true);
 expect(mapSchema.safeParse({...map,annotations:[wall,wall]}).success).toBe(false);
 expect(mapSchema.safeParse({...map,annotations:[{...wall,to:{x:101,y:0}}]}).success).toBe(false);
 expect(mapSchema.safeParse({...map,annotations:[{...base,kind:'light',center:{x:90,y:90},radius:80}]}).success).toBe(true);
 expect(mapSchema.safeParse({...map,annotations:[{...base,kind:'light',center:{x:101,y:90},radius:80}]}).success).toBe(false);
});
test('миграция v5 сохраняет каталог и камеры, v6 восстанавливает разметку разных карт',()=>{
 const c=createCampaign('Разметка');c.characters.push({id:crypto.randomUUID(),name:'NPC',resources:{},values:{},kind:'npc',footprint:{width:1,height:1},portrait:null});const {annotations,...oldMap}=map;
 const old={...c,schemaVersion:5,maps:[oldMap],view:{activeMapId:map.id,cameras:{[map.id]:{x:10,y:-20,zoom:0.5}}}};
 const migrated=parseCampaign(old);expect(migrated.maps[0].annotations).toEqual([]);expect(migrated.view).toEqual(old.view);expect(migrated.characters).toEqual(old.characters);expect(old.schemaVersion).toBe(5);
 const second={...map,id:crypto.randomUUID(),annotations:[]};const next={...c,maps:[map,second]};
 expect(parseCampaign(JSON.parse(JSON.stringify(next))).maps).toEqual([map,second]);
});
