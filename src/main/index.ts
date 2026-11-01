import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { campaignSchema, createCampaign, type Result } from '../shared/campaign.js';
import { readCampaign, writeCampaign } from './storage.js';
const here = dirname(fileURLToPath(import.meta.url));
let window: BrowserWindow;
async function result<T>(action: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, value: await action() }; }
  catch (error) { console.error(error); return { ok: false, error: 'Не удалось выполнить операцию. Проверьте формат файла, права доступа и свободное место. Исходный файл не изменяйте.' }; }
}
app.whenReady().then(() => {
  ipcMain.handle('campaign:create', (event, name: unknown) => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame || typeof name !== 'string') throw new Error('Недопустимый запрос');
    return createCampaign(name);
  }));
  ipcMain.handle('campaign:save', (event, input: unknown) => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый запрос');
    const campaign = campaignSchema.parse(input);
    const selected = await dialog.showSaveDialog(window, { title: 'Сохранить партию', defaultPath: 'Партия.rprison.json', filters: [{ name: 'Партия R Prison', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePath) return null;
    const saved = await writeCampaign(selected.filePath, { ...campaign, updatedAt: new Date().toISOString() });
    return { campaign: saved, fileName: basename(selected.filePath) };
  }));
  ipcMain.handle('campaign:open', (event) => result(async () => {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый запрос');
    const selected = await dialog.showOpenDialog(window, { title: 'Открыть партию', properties: ['openFile'], filters: [{ name: 'Партия R Prison', extensions: ['json'] }] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    return { campaign: await readCampaign(selected.filePaths[0]), fileName: basename(selected.filePaths[0]) };
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
