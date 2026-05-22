'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../supabase/browser';


export interface UserPermissionsProfile {
  permissions: string[];
  isSuperAdmin: boolean;
  isLoading: boolean;
}

export function usePermissions() {
  const [state, setState] = useState<UserPermissionsProfile>({
    permissions: [],
    isSuperAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    // Instantiate your official SSR-safe browser client instance
    const supabase = createSupabaseBrowserClient();

    async function loadInitialSessionClaims() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setState({ permissions: [], isSuperAdmin: false, isLoading: false });
          return;
        }

        // Extract custom security metadata sync'd down inside the user's JWT
        const appMetadata = session.user.app_metadata || {};
        const permissions = appMetadata.permissions || [];
        const isSuperAdmin = appMetadata.is_super_admin || false;

        setState({ permissions, isSuperAdmin, isLoading: false });
      } catch (error) {
        console.error('Error parsing security claims from browser storage:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }

    // 1. Run the initial session verification on mount
    loadInitialSessionClaims();

    // 2. Listen for auth changes (token refreshes, sign-ins, metadata updates)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const appMetadata = session.user.app_metadata || {};
        setState({
          permissions: appMetadata.permissions || [],
          isSuperAdmin: appMetadata.is_super_admin || false,
          isLoading: false,
        });
      } else {
        setState({ permissions: [], isSuperAdmin: false, isLoading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Evaluates if the current user possesses a required permission.
   * Super Admins bypass all explicit rules.
   */
  const hasPermission = (permissionId: string): boolean => {
    if (state.isSuperAdmin) return true;
    return state.permissions.includes(permissionId);
  };

  /**
   * Evaluates if the current user possesses AT LEAST ONE of the provided permissions.
   */
  const hasAnyPermission = (permissionIds: string[]): boolean => {
    if (state.isSuperAdmin) return true;
    return permissionIds.some(id => state.permissions.includes(id));
  };

  return {
    ...state,
    hasPermission,
    hasAnyPermission,
  };
}