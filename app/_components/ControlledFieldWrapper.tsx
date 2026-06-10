// components/ControlledFieldWrapper.tsx
interface ControlledViewProps {
  permission: string;
  userPermissions: string[];
  isSuperAdmin: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ControlledAccessView({ permission, userPermissions, isSuperAdmin, fallback = null, children }: ControlledViewProps) {
  const hasAccess = isSuperAdmin || userPermissions.includes(permission);
  
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}