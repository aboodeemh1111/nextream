'use client';

import { useState } from 'react';
import { FaComment, FaCheck, FaTimes, FaChartBar } from 'react-icons/fa';
import ReviewsTable from '@/components/reviews/ReviewsTable';
import ReviewStats from '@/components/reviews/ReviewStats';
import { useAuth } from '@/context/AuthContext';

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'stats'>('all');
  const { user } = useAuth();

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-700">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
            User Reviews Management
          </h1>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('all')}
                className={`${
                  activeTab === 'all'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaComment className="mr-2" />
                All Reviews
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`${
                  activeTab === 'pending'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaTimes className="mr-2" />
                Pending Approval
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`${
                  activeTab === 'approved'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaCheck className="mr-2" />
                Approved
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`${
                  activeTab === 'stats'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaChartBar className="mr-2" />
                Statistics
              </button>
            </nav>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="bg-white shadow rounded-lg">
          {activeTab === 'all' && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">All Reviews</h2>
              <ReviewsTable 
                filter="all" 
                onReviewUpdated={() => {
                  // Force refresh if needed
                }}
              />
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Pending Reviews</h2>
              <ReviewsTable 
                filter="pending" 
                onReviewUpdated={() => {
                  // Force refresh if needed
                }}
              />
            </div>
          )}

          {activeTab === 'approved' && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Approved Reviews</h2>
              <ReviewsTable 
                filter="approved" 
                onReviewUpdated={() => {
                  // Force refresh if needed
                }}
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Review Statistics</h2>
              <ReviewStats />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 