'use client';

import { useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import UserForm from '@/components/UserForm';
import { FaEdit } from 'react-icons/fa';

export default function EditUserPage() {
  const params = useParams();
  const userId = params.id as string;

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <FaEdit className="mr-2 text-red-600" /> Edit User
          </h1>
          <p className="text-muted-foreground mt-1">
            Update user account details, role, and profile picture.
          </p>
        </div>

        <UserForm userId={userId} isEdit={true} />
      </div>
    </AdminLayout>
  );
}
