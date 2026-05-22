import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OrgWithMeta {
  id: string;
  name: string;
  slug: string;
  role: string;
  project_count: number;
  member_count: number;
  created_at: string;
}

interface OrgState {
  organizations: OrgWithMeta[];
  currentOrgId: string | null;
  loading: boolean;

  setOrganizations: (orgs: OrgWithMeta[]) => void;
  setCurrentOrg: (id: string) => void;
  addOrganization: (org: OrgWithMeta) => void;
  setLoading: (loading: boolean) => void;

  get currentOrg(): OrgWithMeta | undefined;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      organizations: [],
      currentOrgId: null,
      loading: false,

      setOrganizations: (orgs) =>
        set((state) => ({
          organizations: orgs,
          currentOrgId: state.currentOrgId ?? orgs[0]?.id ?? null,
        })),

      setCurrentOrg: (id) => set({ currentOrgId: id }),

      addOrganization: (org) =>
        set((state) => ({
          organizations: [...state.organizations, org],
          currentOrgId: state.currentOrgId ?? org.id,
        })),

      setLoading: (loading) => set({ loading }),

      get currentOrg() {
        const state = get();
        return state.organizations.find((o) => o.id === state.currentOrgId);
      },
    }),
    {
      name: 'monitorx-org',
      partialState: (state) => ({ currentOrgId: state.currentOrgId }),
    } as Parameters<typeof persist>[1]
  )
);
