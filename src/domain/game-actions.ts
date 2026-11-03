import {rPrisonDraft} from './presets/rprison.js';
import {awardPrisonNPC} from './prison-progression.js';
import {pickupPrisonItem} from './prison-inventory.js';
import {usePrisonItem,usePrisonAbility} from './prison-mechanics.js';
import type {Campaign} from '../shared/campaign.js';
import type {AttackInput} from '../shared/gameplay.js';
import type {DiceRoll} from '../shared/dice.js';
import type {RandomSource} from './dice.js';
import * as legacy from './legacy-actions.js';
import {isPrison} from './prison-state.js';
import {previewPrisonAttack,calculatePrisonAttack,applyPrisonAttack} from './prison-combat.js';
export const event=legacy.event;
export const preserveResources=legacy.preserveResources;
export function ensureCoreStats(c:Campaign){if(!isPrison(c))return legacy.ensureCoreStats(c);const p=rPrisonDraft();return {...c,ruleset:{...c.ruleset,stats:[...c.ruleset.stats,...p.stats.filter(s=>!c.ruleset.stats.some(t=>t.key===s.key))],healthStat:c.ruleset.healthStat??'hp_max',initiativeStat:c.ruleset.initiativeStat??'dexterity',movement:{...c.ruleset.movement,budgetStat:c.ruleset.movement.budgetStat??'ap_max'}}};}
export const parseDice=legacy.parseDice;
export function tickEffects(c:Campaign,id:string){if(!isPrison(c)||!c.ruleset.healthStat||c.characters.find(ch=>ch.id===id)?.resources[c.ruleset.healthStat]!==0)return legacy.tickEffects(c,id);const suppressed={...c,effects:c.effects.map(e=>e.ownerId===id&&e.periodicHP>0?{...e,periodicHP:0}:e)},next=legacy.tickEffects(suppressed,id);return {...next,effects:next.effects.map(e=>{const original=c.effects.find(old=>old.id===e.id);return original?{...e,periodicHP:original.periodicHP}:e;})};}
export function calculateAttack(c:Campaign,i:AttackInput,r:DiceRoll[]){return isPrison(c)?calculatePrisonAttack(c,i,r):legacy.calculateAttack(c,i,r);}
export function previewAttack(c:Campaign,i:AttackInput,r?:RandomSource){return isPrison(c)?previewPrisonAttack(c,i,r):legacy.previewAttack(c,i,r);}
export function applyAttack(c:Campaign){return isPrison(c)?applyPrisonAttack(c):legacy.applyAttack(c);}
export function useAbility(c:Campaign,id:string,targetId:string,r?:RandomSource){return isPrison(c)?usePrisonAbility(c,id,targetId,r):legacy.useAbility(c,id,targetId,r);}
export function useItem(c:Campaign,id:string,targetId:string,r?:RandomSource){return isPrison(c)?usePrisonItem(c,id,targetId,r):legacy.useItem(c,id,targetId,r);}
export function pickupItem(c:Campaign,itemId:string,id:string){return isPrison(c)?pickupPrisonItem(c,itemId,id):legacy.pickupItem(c,itemId,id);}
export const breakWall=legacy.breakWall;
export const strikeWall=legacy.strikeWall;
export function awardExperience(c:Campaign,id:string,recipients:string[]){return isPrison(c)?awardPrisonNPC(c,id,recipients):legacy.awardExperience(c,id,recipients);}
