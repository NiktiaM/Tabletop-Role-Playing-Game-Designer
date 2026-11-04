import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {skillIds} from '../shared/prison.js';
export function skillLimit(level:number){return 1+[5,10,15].filter(n=>level>=n).length;}
export function setCharacterSkills(c:Campaign,id:string,skills:string[]){const ch=c.characters.find(ch=>ch.id===id);if(!ch)throw new Error('Персонаж не найден');if(new Set(skills).size!==skills.length||skills.some(s=>!skillIds.includes(s as typeof skillIds[number]))||skills.length>(ch.kind==='npc'?4:skillLimit(ch.values.level??1)))throw new Error('Проверьте навыки и их число по уровню');return campaignSchema.parse({...c,characters:c.characters.map(row=>row.id===id?{...row,prisonProfile:{...row.prisonProfile,skills}}:row)});}
