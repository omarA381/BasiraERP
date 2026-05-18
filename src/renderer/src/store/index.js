import { create } from 'zustand';

/**
 * Global application store.
 * Add slices or separate stores as the app grows.
 */

const useAppStore = create((set) => ({
  // App state
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // User state
  user: null,
  setUser: (user) => set({ user })
}));

export default useAppStore;