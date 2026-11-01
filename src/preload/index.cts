import { contextBridge, ipcRenderer } from 'electron';
import type { CampaignAPI } from '../shared/campaign.js';
const api: CampaignAPI = {
 importContent: () => ipcRenderer.invoke('campaign:import-content'),
  importPortrait: () => ipcRenderer.invoke('campaign:import-portrait'),
  importMap: () => ipcRenderer.invoke('campaign:import-map'),
  create: name => ipcRenderer.invoke('campaign:create', name),
  save: campaign => ipcRenderer.invoke('campaign:save', campaign),
  open: () => ipcRenderer.invoke('campaign:open'),
};
contextBridge.exposeInMainWorld('campaigns', api);
