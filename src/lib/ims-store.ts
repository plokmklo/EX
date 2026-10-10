'use client';

/**
 * EX-IMS global client store (zustand): current view + inventory search handoff
 * for the ⌘K command palette / notification deep links.
 */
import { create } from 'zustand';
import type { ImsView } from '@/types/ims';

interface ImsStore {
  currentView: ImsView;
  /** Pending search text to pre-fill the Inventory view (from ⌘K palette etc.) */
  inventorySearch: string;
  setView: (v: ImsView) => void;
  navigateToInventory: (search?: string) => void;
  consumeInventorySearch: () => string;
}

export const useImsStore = create<ImsStore>((set, get) => ({
  currentView: 'dashboard',
  inventorySearch: '',
  setView: (currentView) => set({ currentView }),
  navigateToInventory: (search) =>
    set({ currentView: 'inventory', inventorySearch: search ?? '' }),
  consumeInventorySearch: () => {
    const v = get().inventorySearch;
    if (v) set({ inventorySearch: '' });
    return v;
  },
}));
