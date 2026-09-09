import { contextBridge, ipcRenderer } from 'electron';
import type { SuperCardAPI } from '../shared/types';
const api: SuperCardAPI = {
  loadAppearance: () => ipcRenderer.invoke('appearance:load'),
  saveAppearance: (value) => ipcRenderer.invoke('appearance:save', value),
  chooseBackground: () => ipcRenderer.invoke('appearance:background'),
  load: () => ipcRenderer.invoke('collection:load'),
  createDeck: (name) => ipcRenderer.invoke('deck:create', name),
  renameDeck: (id, name) => ipcRenderer.invoke('deck:rename', id, name),
  deleteDeck: (id) => ipcRenderer.invoke('deck:delete', id),
  saveCard: (card) => ipcRenderer.invoke('card:save', card),
  deleteCard: (id) => ipcRenderer.invoke('card:delete', id),
  dataPath: () => ipcRenderer.invoke('app:dataPath'),
  onCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:closeRequested', listener);
    void ipcRenderer.invoke('app:closeReady');
    return () => ipcRenderer.removeListener('app:closeRequested', listener);
  },
  finishClose: () => ipcRenderer.invoke('app:finishClose'),
  pickImages: () => ipcRenderer.invoke('image:pick'),
  addImage: (bytes) => ipcRenderer.invoke('image:add', bytes),
  chooseCSV: () => ipcRenderer.invoke('csv:choose'),
  reparseCSV: (token, delimiter) => ipcRenderer.invoke('csv:reparse', token, delimiter),
  chooseMediaFolder: () => ipcRenderer.invoke('media:chooseFolder'),
  importCSV: (options) => ipcRenderer.invoke('csv:import', options),
  exportDeck: (id) => ipcRenderer.invoke('deck:export', id),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  previewBackup: () => ipcRenderer.invoke('backup:preview'),
  restoreBackup: (token) => ipcRenderer.invoke('backup:restore', token),
};
contextBridge.exposeInMainWorld('supercard', api);
