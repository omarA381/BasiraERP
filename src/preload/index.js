import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('nexterp', {
  // IPC invoke helper
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // IPC on/off helpers
  on: (channel, callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  // IPC send (fire-and-forget)
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),

  // App info
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  testConnection: (config) => ipcRenderer.invoke('db:test-connection', config),
  saveDbConfig: (config) => ipcRenderer.invoke('db:save-config', config),
  loadDbConfig: () => ipcRenderer.invoke('db:load-config'),
  deleteDbConfig: () => ipcRenderer.invoke('db:delete-config'),
  migrate: () => ipcRenderer.invoke('db:migrate'),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCompanies: () => ipcRenderer.invoke('auth:get-companies'),
});