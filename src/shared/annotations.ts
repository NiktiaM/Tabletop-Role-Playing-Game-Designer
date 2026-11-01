import {z} from 'zod';
const point=z.object({x:z.number().finite().min(0).max(8192),y:z.number().finite().min(0).max(8192)}).strict();
const base={id:z.uuid(),name:z.string().trim().min(1).max(80),visible:z.boolean()};
const segment={from:point,to:point};
export const annotationSchema=z.discriminatedUnion('kind',[
 z.object({...base,...segment,kind:z.literal('wall'),destructible:z.boolean(),hp:z.number().int().min(1).max(100000)}).strict(),
 z.object({...base,...segment,kind:z.literal('cover'),level:z.enum(['light','medium','nearFull'])}).strict(),
 z.object({...base,...segment,kind:z.literal('elevation'),heightMeters:z.number().finite().min(-1000).max(1000)}).strict(),
 z.object({...base,...segment,kind:z.literal('liquid'),liquidType:z.enum(['water','oil','acid','lava','other'])}).strict(),
 z.object({...base,kind:z.literal('light'),center:point,radius:z.number().finite().min(1).max(12000)}).strict(),
]).superRefine((item,ctx)=>{
 if(item.kind==='light')return;
 if(item.kind==='wall' ? Math.hypot(item.to.x-item.from.x,item.to.y-item.from.y)<1 : Math.abs(item.to.x-item.from.x)<1||Math.abs(item.to.y-item.from.y)<1)
   ctx.addIssue({code:'custom',message:'Разметка слишком мала: минимум 1 пиксель по каждой необходимой оси'});
});
export type Annotation=z.infer<typeof annotationSchema>;
export const annotationNames:Record<Annotation['kind'],string>={wall:'Стена',cover:'Укрытие',elevation:'Высота',liquid:'Жидкость',light:'Свет'};
