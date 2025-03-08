'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { FaUserPlus, FaEdit, FaTrash, FaSearch, FaUser, FaFilter, FaSort, FaEllipsisH } from 'react-icons/fa';

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
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [sortBy, setSortBy] = useState<'username' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        const res = await axios.get(
          `/api/users`,
          {
            headers: {
              token: `Bearer ${user.accessToken}`
            }
          }
        );
        
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setUsers(res.data);
        } else {
          // Use mock data if no users are returned
          setUsers([
            {
              _id: '1',
              username: 'john_doe',
              email: 'john@example.com',
              profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
              isAdmin: false,
              createdAt: '2023-01-15T10:30:00.000Z'
            },
            {
              _id: '2',
              username: 'jane_smith',
              email: 'jane@example.com',
              profilePic: 'https://randomuser.me/api/portraits/women/1.jpg',
              isAdmin: true,
              createdAt: '2023-02-20T14:45:00.000Z'
            },
            {
              _id: '3',
              username: 'mike_johnson',
              email: 'mike@example.com',
              isAdmin: false,
              createdAt: '2023-03-10T09:15:00.000Z'
            },
            {
              _id: '4',
              username: 'sarah_williams',
              email: 'sarah@example.com',
              profilePic: 'https://randomuser.me/api/portraits/women/2.jpg',
              isAdmin: false,
              createdAt: '2023-04-05T16:30:00.000Z'
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
            username: 'john_doe',
            email: 'john@example.com',
            profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
            isAdmin: false,
            createdAt: '2023-01-15T10:30:00.000Z'
          },
          {
            _id: '2',
            username: 'jane_smith',
            email: 'jane@example.com',
            profilePic: 'https://randomuser.me/api/portraits/women/1.jpg',
            isAdmin: true,
            createdAt: '2023-02-20T14:45:00.000Z'
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
        // await axios.delete(`/api/users/${userId}`, {
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

  const toggleSort = (field: 'username' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const toggleUserActions = (userId: string) => {
    setSelectedUser(selectedUser === userId ? null : userId);
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      // Apply search filter
      const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply role filter
      const matchesRole = filterRole === 'all' || 
                         (filterRole === 'admin' && user.isAdmin) || 
                         (filterRole === 'user' && !user.isAdmin);
      
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === 'username') {
        return sortOrder === 'asc' 
          ? a.username.localeCompare(b.username)
          : b.username.localeCompare(a.username);
      } else {
        return sortOrder === 'asc'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  return (
    <AdminLayout>
      <div>
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-gray-600 mt-1">Manage your platform users</p>
        </div>
        
        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-grow max-w-md">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Role Filter */}
              <div className="relative">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as 'all' | 'admin' | 'user')}
                  className="appearance-none pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="user">Regular Users</option>
                </select>
                <FaFilter className="absolute left-3 top-3 text-gray-400" />
              </div>
              
              {/* Add User Button */}
              <Link
                href="/users/new"
                className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                <FaUserPlus className="mr-2" /> Add User
              </Link>
            </div>
          </div>
        </div>
        
        {/* Users List */}
        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
            <div className="flex items-center">
              <div className="py-1">
                <svg className="h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-bold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center">
                <FaUser className="mx-auto text-gray-300 text-5xl mb-4" />
                <h3 className="text-lg font-medium text-gray-800 mb-2">No users found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setFilterRole('all');
                  }}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => toggleSort('username')}
                        >
                          <div className="flex items-center">
                            Role
                            {sortBy === 'username' && (
                              <FaSort className="ml-1 text-gray-400" />
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => toggleSort('date')}
                        >
                          <div className="flex items-center">
                            Joined
                            {sortBy === 'date' && (
                              <FaSort className="ml-1 text-gray-400" />
                            )}
                          </div>
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.map((user) => (
                        <tr key={user._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                {user.profilePic ? (
                                  <Image
                                    className="h-10 w-10 rounded-full object-cover"
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
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
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
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile Card View */}
                <div className="md:hidden">
                  <ul className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <li key={user._id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              {user.profilePic ? (
                                <Image
                                  className="h-10 w-10 rounded-full object-cover"
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
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{user.username}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                          
                          <div className="relative">
                            <button 
                              onClick={() => toggleUserActions(user._id)}
                              className="p-2 text-gray-500 rounded-full hover:bg-gray-100"
                            >
                              <FaEllipsisH />
                            </button>
                            
                            {selectedUser === user._id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                                <Link
                                  href={`/users/${user._id}`}
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <FaEdit className="inline mr-2" /> Edit
                                </Link>
                                <button
                                  onClick={() => handleDelete(user._id)}
                                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                >
                                  <FaTrash className="inline mr-2" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2 flex justify-between items-center">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {user.isAdmin ? 'Admin' : 'User'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Joined {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
} 