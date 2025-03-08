'use client';

import AdminLayout from '@/components/AdminLayout';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
