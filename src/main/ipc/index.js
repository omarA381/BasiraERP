/**
 * IPC handler registration.
 * Register all IPC handlers here so they are available to the renderer.
 */
import { registerAuthIpc } from './auth.ipc.js';
import { registerCompanyIpc } from './company.ipc.js';
import { registerDbConfigIpc } from './dbConfig.ipc.js';
import { registerUserIpc } from './user.ipc.js';

export function registerIpcHandlers() {
  registerDbConfigIpc();
  registerAuthIpc();
  registerCompanyIpc();
  registerUserIpc();
}