/**
 * IPC handler registration.
 * Register all IPC handlers here so they are available to the renderer.
 */
import { registerDbConfigIpc } from './dbConfig.ipc.js';

export function registerIpcHandlers() {
  registerDbConfigIpc();
}