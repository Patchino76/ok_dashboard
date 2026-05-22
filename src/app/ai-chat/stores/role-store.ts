import { create } from "zustand";

// ── Roles ────────────────────────────────────────────────────────────────────
// Role keys are lower-case ASCII for header transport. The Bulgarian labels
// are used only for UI presentation in the dropdown.

export type Role = "mechanic" | "technologist" | "manager";

export const ROLES: { key: Role; label: string }[] = [
  { key: "mechanic", label: "Поддръжка" },
  { key: "technologist", label: "Технолог" },
  { key: "manager", label: "Мениджър" },
];

const STORAGE_KEY = "ai-chat-role";
const DEFAULT_ROLE: Role = "technologist";

function loadRole(): Role {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "mechanic" || v === "technologist" || v === "manager") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ROLE;
}

function saveRole(role: Role) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, role);
  } catch {
    /* ignore */
  }
}

interface RoleState {
  role: Role;
  hydrated: boolean;
  setRole: (role: Role) => void;
  hydrate: () => void;
}

export const useRoleStore = create<RoleState>((set) => ({
  // Default during SSR — replaced on hydrate() so localStorage persists.
  role: DEFAULT_ROLE,
  hydrated: false,
  setRole: (role) => {
    saveRole(role);
    set({ role });
  },
  hydrate: () => {
    set({ role: loadRole(), hydrated: true });
  },
}));

/** Synchronous accessor for fetch helpers that aren't React components. */
export function getCurrentRole(): Role {
  return useRoleStore.getState().role;
}
