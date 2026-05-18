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