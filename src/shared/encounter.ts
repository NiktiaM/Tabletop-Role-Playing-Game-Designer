import {z} from 'zod';
import {statKey} from './rules.js';

export const participantSchema=z.object({tieBreaker:z.number().int().min(0).max(200).optional(),surprised:z.boolean().optional(),availableRound:z.number().int().positive().optional(),characterId:z.uuid(),roll:z.number().int().min(1).max(20).optional(),modifier:z.number().int().min(-1000000).max(1000000).optional(),initiative:z.number().finite().min(-1000000).max(1000000)}).strict().refine(row=>(row.roll===undefined&&row.modifier===undefined)||(row.roll!==undefined&&row.modifier!==undefined&&row.initiative===row.roll+row.modifier),'Неверный результат инициативы');
export const recoverySchema=z.enum(['turn','round','manual']);
export const encounterSchema=z.object({
 name:z.string().max(120).optional(),startedAt:z.number().nonnegative().optional(),id:z.uuid(),participants:z.array(participantSchema).min(1).max(200),
 round:z.number().int().min(1).max(1000000),turnIndex:z.number().int().min(0).max(199),
 recovery:recoverySchema,apStat:statKey,previousTacticalMovement:z.boolean(),
}).strict().superRefine((encounter,ctx)=>{
 if(new Set(encounter.participants.map(row=>row.characterId)).size!==encounter.participants.length)ctx.addIssue({code:'custom',message:'Персонаж участвует в бою только один раз'});
 if(encounter.turnIndex>=encounter.participants.length)ctx.addIssue({code:'custom',message:'Текущий ход выходит за порядок участников'});
});
export type Encounter=z.infer<typeof encounterSchema>;
export type Participant=z.infer<typeof participantSchema>;
export type Recovery=z.infer<typeof recoverySchema>;
