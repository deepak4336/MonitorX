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
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      organizations: [],
      currentOrgId: null,
      loading: false,

      setOrganizations: (orgs: OrgWithMeta[]) =>
        set((state) => ({
          organizations: orgs,
          currentOrgId: state.currentOrgId ?? orgs[0]?.id ?? null,
        })),

      setCurrentOrg: (id: string) => set({ currentOrgId: id }),

      addOrganization: (org: OrgWithMeta) =>
        set((state) => ({
          organizations: [...state.organizations, org],
          currentOrgId: state.currentOrgId ?? org.id,
        })),

      setLoading: (loading: boolean) => set({ loading }),
    }),
    {
      name: 'monitorx-org',
    }
  )
);