'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUser, FaEdit, FaLock, FaSignOutAlt } from 'react-icons/fa';

export default function Profile() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    setUsername(user.username);
    setEmail(user.email);
  }, [user, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await axios.put(
        `http://localhost:8800/api/users/${user._id}`,
        { username, email },
        {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        }
      );
      
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await axios.put(
        `http://localhost:8800/api/users/password/${user._id}`,
        { currentPassword, newPassword },
        {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        }
      );
      
      setSuccess('Password changed successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto bg-gray-800 rounded-lg overflow-hidden shadow-xl">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-white text-3xl font-bold">Account Profile</h1>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-400 hover:text-white"
              >
                <FaSignOutAlt className="mr-2" /> Sign Out
              </button>
            </div>
            
            {error && (
              <div className="bg-red-500 text-white p-3 rounded mb-4">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-500 text-white p-3 rounded mb-4">
                {success}
              </div>
            )}
            
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/3 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mb-4">
                  {user.profilePic ? (
                    <Image
                      src={user.profilePic}
                      alt={user.username}
                      width={128}
                      height={128}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <FaUser className="text-gray-500 text-5xl" />
                  )}
                </div>
                <button className="text-red-600 hover:underline">
                  Change Avatar
                </button>
              </div>
              
              <div className="md:w-2/3">
                {isEditing ? (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                      <label className="block text-gray-400 mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                        required
                      />
                    </div>
                    
                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition disabled:opacity-70"
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setUsername(user.username);
                          setEmail(user.email);
                        }}
                        className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 mb-1">Username</label>
                      <div className="text-white text-lg">{user.username}</div>
                    </div>
                    
                    <div>
                      <label className="block text-gray-400 mb-1">Email</label>
                      <div className="text-white text-lg">{user.email}</div>
                    </div>
                    
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center text-red-600 hover:text-red-500"
                    >
                      <FaEdit className="mr-2" /> Edit Profile
                    </button>
                  </div>
                )}
                
                <div className="mt-8 pt-8 border-t border-gray-700">
                  <h2 className="text-white text-xl font-semibold mb-4 flex items-center">
                    <FaLock className="mr-2" /> Password & Security
                  </h2>
                  
                  {isChangingPassword ? (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <label className="block text-gray-400 mb-1">Current Password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-400 mb-1">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-400 mb-1">Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                          required
                        />
                      </div>
                      
                      <div className="flex space-x-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition disabled:opacity-70"
                        >
                          {loading ? 'Changing...' : 'Change Password'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingPassword(false);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmPassword('');
                          }}
                          className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="bg-gray-700 text-white px-6 py-2 rounded hover:bg-gray-600 transition"
                    >
                      Change Password
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 