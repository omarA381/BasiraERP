import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  company: null,

  setUser: (user) => set({ user, isAuthenticated: true }),

  logout: () => set({ user: null, isAuthenticated: false, company: null }),

  setCompany: (company) => set({ company }),
}));

export default useAuthStore;