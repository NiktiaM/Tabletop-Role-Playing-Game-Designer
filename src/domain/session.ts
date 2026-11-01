import type {Campaign} from '../shared/campaign.js';
export function startGame(campaign:Campaign):Campaign {
 if(!campaign.maps.length)throw new Error('Перед началом игры добавьте хотя бы одно поле');
 return {...campaign,session:{...campaign.session,started:true},view:{...campaign.view,activeMapId:campaign.view.activeMapId??campaign.maps[0].id}};
}
export function setTacticalMovement(campaign:Campaign,enabled:boolean):Campaign {
 if(campaign.encounter&&!enabled)throw new Error('Завершите бой, чтобы отключить расход ОД');
 if(!campaign.session.started)throw new Error('Сначала начните игру');
 return {...campaign,session:{...campaign.session,tacticalMovement:enabled}};
}
