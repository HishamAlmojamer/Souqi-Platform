import { Redirect } from 'expo-router';

import { RoleDashboard } from '@/components/b2b/RoleDashboard';
import { withNext } from '@/data/navigation';
import { useAuth } from '@/state/AuthContext';

export default function DashboardScreen() {
  const { token, ready } = useAuth();

  if (!ready) {
    return null;
  }

  if (!token) {
    return <Redirect href={withNext('/login', '/dashboard') as any} />;
  }

  return <RoleDashboard />;
}
