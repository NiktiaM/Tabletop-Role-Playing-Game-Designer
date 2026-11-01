import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { campaignSchema, mapSchema, portraitSchema, createCampaign, type Result } from '../shared/campaign.js';
import { readCampaign, writeCampaign } from './storage.js';
const here = dirname(fileURLToPath(import.meta.url));
let window: BrowserWindow;
async function result<T>(action: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, value: await action() }; }
  catch (error) { console.error(error); return { ok: false, error: 'Не удалось выполнить операцию. Проверьте формат, права доступа и свободное место. Карта: PNG/JPG до 15 МБ, до 8192 пикселей по стороне и 32 млн пикселей. Партия: до 100 МБ. Исходный файл не изменяйте.' }; }
}
function validateImages(campaign: import('../shared/campaign.js').Campaign) {
  for (const map of campaign.maps) {
    const image = nativeImage.createFromDataURL(map.image);
    const size = image.getSize();
    if (image.isEmpty() || size.width !== map.width || size.height !== map.height) throw new Error('Повреждённое изображение карты');
  }
  for (const character of campaign.characters) {
    if(character.portrait) {
      const image=nativeImage.createFromDataURL(character.portrait), size=image.getSize();
      if(image.isEmpty()||size.width>512||size.height>512) throw new Error('Некорректный портрет');
    }
  }
  return campaign;
}
app.whenReady().then(() => {
  ipcMain.handle('campaign:import-portrait',event=>result(async()=>{
    if(event.senderFrame!==window.webContents.mainFrame) throw new Error('Недопустимый запрос');
    const selected=await dialog.showOpenDialog(window,{title:'Портрет персонажа',properties:['openFile'],filters:[{name:'PNG/JPG',extensions:['png','jpg','jpeg']}]});
    if(selected.canceled||!selected.filePaths[0]) return null;
    const path=selected.filePaths[0];
    if((await stat(path)).size>15*1024*1024) throw new Error('Портрет превышает 15 МБ');
    const bytes=await readFile(path);
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(!png && !(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)) throw new Error('Ожидался PNG/JPG');
    const image=nativeImage.createFromBuffer(bytes), size=image.getSize();
    if(image.isEmpty()||size.width*size.height>32_000_000||size.width>8192||size.height>8192) throw new Error('Неподдерживаемый портрет');
    const scale=Math.min(1,512/Math.max(size.width,size.height));
    return portraitSchema.parse(image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))}).toDataURL());
  }));
  ipcMain.handle('campaign:import-map', event => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый запрос');
    const selected = await dialog.showOpenDialog(window, { title: 'Добавить карту', properties: ['openFile'], filters: [{ name: 'Карты PNG/JPG', extensions: ['png', 'jpg', 'jpeg'] }] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const path = selected.filePaths[0];
    if ((await stat(path)).size > 15 * 1024 * 1024) throw new Error('Карта превышает 15 МБ');
    const bytes = await readFile(path);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpeg) throw new Error('Ожидалось PNG или JPEG');
    const image = nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) throw new Error('Не удалось прочитать изображение');
    const size = image.getSize();
    return mapSchema.parse({ id: randomUUID(), name: basename(path).slice(0,120), width: size.width, height: size.height, image: `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}` });
  }));
  ipcMain.handle('campaign:create', (event, name: unknown) => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame || typeof name !== 'string') throw new Error('Недопустимый запрос');
    return createCampaign(name);
  }));
  ipcMain.handle('campaign:save', (event, input: unknown) => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый запрос');
    const campaign = validateImages(campaignSchema.parse(input));
    const selected = await dialog.showSaveDialog(window, { title: 'Сохранить партию', defaultPath: 'Партия.rprison.json', filters: [{ name: 'Партия R Prison', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePath) return null;
    const saved = await writeCampaign(selected.filePath, { ...campaign, updatedAt: new Date().toISOString() });
    return { campaign: saved, fileName: basename(selected.filePath) };
  }));
  ipcMain.handle('campaign:open', (event) => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый запрос');
    const selected = await dialog.showOpenDialog(window, { title: 'Открыть партию', properties: ['openFile'], filters: [{ name: 'Партия R Prison', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    return { campaign: validateImages(await readCampaign(selected.filePaths[0])), fileName: basename(selected.filePaths[0]) };
  }));
  const createWindow = () => {
    window = new BrowserWindow({ width: 1120, height: 760, minWidth: 760, minHeight: 580, backgroundColor: '#12151c', webPreferences: { preload: join(here, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.webContents.on('will-prevent-unload', event => {
      const choice = dialog.showMessageBoxSync(window, { type: 'question', buttons: ['Остаться', 'Закрыть без сохранения'], defaultId: 0, cancelId: 0, title: 'Несохранённая партия', message: 'Закрыть приложение без сохранения партии?' });
      if (choice === 1) event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    void window.loadFile(join(here, '../renderer/index.html'));
  };
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
