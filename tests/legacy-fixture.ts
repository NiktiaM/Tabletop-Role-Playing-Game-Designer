// Explicit historical fixtures keep compatibility coverage separate from Prison0.3 acceptance tests.
import {createCampaign as createCurrentCampaign} from '../src/shared/campaign.js';
import {rPrisonLegacyDraft} from '../src/domain/presets/rprison.js';
import {gameplaySchema} from '../src/shared/gameplay.js';
export function legacyCampaign(name:string){const c=createCurrentCampaign(name);return {...c,itemTemplates:[],ruleset:rPrisonLegacyDraft(),gameplay:gameplaySchema.parse({})};}
