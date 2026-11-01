import {z} from 'zod';
export const portraitSchema=z.string().max(2*1024*1024).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
