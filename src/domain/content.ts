import {campaignSchema,type Campaign} from '../shared/campaign.js';
import {contentSchema,type ContentPack} from '../shared/content.js';
export function mergeContent(campaign:Campaign,input:ContentPack):Campaign {
 const pack=contentSchema.parse(input),keys=new Set(campaign.ruleset.stats.filter(stat=>stat.kind==='base').map(stat=>stat.key));
 const unknown=[...new Set(pack.characters.flatMap(character=>Object.keys(character.values).filter(key=>!keys.has(key))))];
 if(unknown.length)throw new Error(`В правилах партии нет исходных показателей: ${unknown.join(', ')}. Исправьте ключи в файле или правила партии.`);
 const candidate={...campaign,characters:[...campaign.characters,...pack.characters.map(character=>({...character,id:crypto.randomUUID()}))],itemTemplates:[...campaign.itemTemplates,...pack.items.map(template=>({...template,id:crypto.randomUUID(),revision:1}))]};
 const result=campaignSchema.safeParse(candidate);if(!result.success)throw new Error('Превышен предел 200 персонажей или 200 шаблонов, либо данные партии несовместимы.');return result.data;
}
