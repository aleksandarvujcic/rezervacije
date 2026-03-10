import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { permissionsApi } from '../api/endpoints';
import { useAuthStore } from '../stores/authStore';
import type { Permission, RolePermission } from '../api/types';

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.list(),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useHasPermission() {
  const user = useAuthStore((s) => s.user);
  const { data: permissions } = usePermissions();

  return (permission: Permission): boolean => {
    if (!user || !permissions) return false;
    // Owner always has all permissions as fallback
    if (user.role === 'owner' && !permissions.length) return true;
    const entry = permissions.find(
      (p) => p.role === user.role && p.permission === permission
    );
    return entry?.allowed ?? false;
  };
}

export function useUpdatePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissions: RolePermission[]) =>
      permissionsApi.update(permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });
}
