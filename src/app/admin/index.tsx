import { Redirect } from 'expo-router';

import { AdminDashboard } from '@/components/b2b/admin/AdminDashboard';
import { withNext } from '@/data/navigation';
import { useAuth } from '@/state/AuthContext';

export default function AdminScreen() {
  const { ready, token, hasPermission } = useAuth();

  if (!ready) {
    return null;
  }

  if (!token) {
    return <Redirect href={withNext('/login', '/admin') as any} />;
  }

  if (!hasPermission('platform.admin')) {
    return <Redirect href={'/dashboard' as any} />;
  }

  return <AdminDashboard />;
}
