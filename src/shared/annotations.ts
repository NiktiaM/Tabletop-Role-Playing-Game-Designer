import {z} from 'zod';
const point=z.object({x:z.number().finite().min(0).max(8192),y:z.number().finite().min(0).max(8192)}).strict();
const material=z.object({resistance:z.number().min(0).max(10000),hardness:z.number().min(0).max(10000),fracture:z.number().min(0).max(10)}).strict();
const base={sourceMapId:z.uuid().optional(),id:z.uuid(),name:z.string().trim().min(1).max(80),visible:z.boolean()};
const brush=z.object({points:z.array(point).min(1).max(512),radius:z.number().finite().min(.001).max(1024)}).strict().optional();
const segment={from:point,to:point};
export const annotationSchema=z.discriminatedUnion('kind',[
 z.object({...base,...segment,kind:z.literal('wall'),door:z.boolean().optional(),open:z.boolean().optional(),material:material.optional(),destructible:z.boolean(),hp:z.number().positive().max(100000)}).strict(),
 z.object({...base,...segment,kind:z.literal('cover'),blocking:z.boolean().optional(),hp:z.number().nonnegative().max(100000).optional(),maxHP:z.number().positive().max(100000).optional(),material:material.optional(),level:z.enum(['light','medium','nearFull'])}).strict(),
 z.object({...base,...segment,kind:z.literal('elevation'),travel:z.enum(['climb','ladder','stairs']).optional(),rough:z.boolean().optional(),brush,heightMeters:z.number().finite().min(-1000).max(1000)}).strict(),
 z.object({...base,...segment,kind:z.literal('liquid'),brush,liquidType:z.enum(['water','oil','acid','lava','other'])}).strict(),
 z.object({...base,...segment,kind:z.literal('puzzle'),note:z.string().max(4000)}).strict(),
 z.object({...base,kind:z.literal('light'),center:point,radius:z.number().finite().min(.001).max(12000)}).strict(),
]).superRefine((item,ctx)=>{
 if(item.kind==='light')return;
 const minimum=item.sourceMapId ? .001 : 1;
 if(item.kind==='wall' ? Math.hypot(item.to.x-item.from.x,item.to.y-item.from.y)<minimum : Math.abs(item.to.x-item.from.x)<minimum||Math.abs(item.to.y-item.from.y)<minimum)
   ctx.addIssue({code:'custom',message:'Разметка слишком мала: минимум 1 пиксель по каждой необходимой оси'});
});
export type Annotation=z.infer<typeof annotationSchema>;
export const annotationNames:Record<Annotation['kind'],string>={wall:'Стена',cover:'Укрытие',elevation:'Высота',liquid:'Жидкость',light:'Свет',puzzle:'Головоломка'};
