'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { FaUserPlus, FaEdit, FaTrash, FaSearch, FaUser } from 'react-icons/fa';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePic?: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      try {
        setLoading(true);
        console.log('Fetching users with token:', user.accessToken);
        
        // Log the headers being sent
        const headers = {
          token: `Bearer ${user.accessToken}`
        };
        console.log('Request headers:', headers);
        
        const res = await axios.get(
          `/api/users`,
          {
            headers
          }
        );
        
        console.log('Users API response:', res.data);
        
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setUsers(res.data);
          console.log('Successfully loaded', res.data.length, 'users');
        } else {
          console.log('No users found or invalid response format:', res.data);
          // Use mock data if no users are returned
          setUsers([
            {
              _id: '1',
              username: 'john_doe (Mock)',
              email: 'john@example.com',
              profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
              isAdmin: false,
              createdAt: '2023-01-15T10:30:00.000Z'
            }
          ]);
        }
      } catch (err: any) {
        console.error('Error fetching users:', err.response?.data || err.message);
        setError('Failed to load users');
        
        // Use mock data if API call fails
        setUsers([
          {
            _id: '1',
            username: 'john_doe (Mock)',
            email: 'john@example.com',
            profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
            isAdmin: false,
            createdAt: '2023-01-15T10:30:00.000Z'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  const handleDelete = async (userId: string) => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        // In a real application, you would call your API to delete the user
        // await axios.delete(`http://localhost:8800/api/users/${userId}`, {
        //   headers: {
        //     token: `Bearer ${user.accessToken}`,
        //   },
        // });
        
        // Update local state
        setUsers(users.filter(user => user._id !== userId));
      } catch (err) {
        console.error(err);
        alert('Failed to delete user');
      }
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Users</h1>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <Link
              href="/users/new"
              className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
            >
              <FaUserPlus className="mr-2" /> Add User
            </Link>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              {user.profilePic ? (
                                <Image
                                  className="h-10 w-10 rounded-full"
                                  src={user.profilePic}
                                  alt={user.username}
                                  width={40}
                                  height={40}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <FaUser className="text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {user.isAdmin ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/users/${user._id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <FaEdit className="inline mr-1" /> Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FaTrash className="inline mr-1" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
} 