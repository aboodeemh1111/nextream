'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import api from '@/services/api';
import { 
  FaUsers, 
  FaFilm, 
  FaChartLine, 
  FaClock, 
  FaPercentage, 
  FaEye, 
  FaSpinner,
  FaExclamationTriangle,
  FaFilter
} from 'react-icons/fa';
import UserEngagementMetrics from '@/components/analytics/UserEngagementMetrics';
import ContentPerformanceInsights from '@/components/analytics/ContentPerformanceInsights';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'user-engagement' | 'content-performance'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [userEngagementData, setUserEngagementData] = useState<any>(null);
  const [contentPerformanceData, setContentPerformanceData] = useState<any>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | '6months' | 'year'>('month');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'user-engagement' && !userEngagementData) {
      fetchUserEngagementData();
    } else if (activeTab === 'content-performance' && !contentPerformanceData) {
      fetchContentPerformanceData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'user-engagement') {
      fetchUserEngagementData();
    }
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/dashboard', {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setDashboardData(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching analytics dashboard data:', err.response?.data || err.message);
      setError('Failed to load analytics dashboard data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserEngagementData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/user-engagement', {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
        params: { period },
      });
      setUserEngagementData(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching user engagement data:', err.response?.data || err.message);
      setError('Failed to load user engagement data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContentPerformanceData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/content-performance', {
        headers: {
          token: `Bearer ${user?.accessToken}`,
        },
      });
      setContentPerformanceData(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching content performance data:', err.response?.data || err.message);
      setError('Failed to load content performance data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
    } else if (activeTab === 'user-engagement') {
      fetchUserEngagementData();
    } else if (activeTab === 'content-performance') {
      fetchContentPerformanceData();
    }
  };

  const toggleMobileFilters = () => {
    setShowMobileFilters(!showMobileFilters);
  };

  return (
    <AdminLayout>
      <div className="px-2 sm:px-0">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Analytics</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Insights into user engagement and content performance</p>
        </div>
        
        {/* Mobile Filters Button */}
        <div className="md:hidden mb-4">
          <button
            onClick={toggleMobileFilters}
            className="w-full flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-200"
          >
            <span className="flex items-center">
              <FaFilter className="mr-2 text-gray-500" />
              <span className="font-medium">Filters & Options</span>
            </span>
            <span className="text-gray-500">{showMobileFilters ? '▲' : '▼'}</span>
          </button>
        </div>
        
        {/* Filters and Actions */}
        <div className={`mb-6 flex flex-col md:flex-row md:items-center md:justify-between ${showMobileFilters ? 'block' : 'hidden md:flex'}`}>
          {/* Tabs - Mobile View (Dropdown) */}
          <div className="mb-4 md:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="dashboard">Dashboard Overview</option>
              <option value="user-engagement">User Engagement</option>
              <option value="content-performance">Content Performance</option>
            </select>
          </div>
          
          {/* Period Selector - Mobile View */}
          {activeTab === 'user-engagement' && (
            <div className="mb-4 md:mb-0">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="w-full md:w-auto bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="6months">Last 6 Months</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          )}
          
          {/* Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={handleRefresh}
              className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition flex items-center justify-center w-full md:w-auto"
              disabled={loading}
            >
              {loading ? <FaSpinner className="animate-spin mr-2" /> : null}
              Refresh Data
            </button>
          </div>
        </div>
        
        {/* Tabs - Desktop View */}
        <div className="hidden md:block mb-6 border-b border-gray-200">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
            <li className="mr-2">
              <button
                className={`inline-block p-4 rounded-t-lg border-b-2 ${
                  activeTab === 'dashboard'
                    ? 'text-red-600 border-red-600'
                    : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard Overview
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block p-4 rounded-t-lg border-b-2 ${
                  activeTab === 'user-engagement'
                    ? 'text-red-600 border-red-600'
                    : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('user-engagement')}
              >
                User Engagement
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block p-4 rounded-t-lg border-b-2 ${
                  activeTab === 'content-performance'
                    ? 'text-red-600 border-red-600'
                    : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('content-performance')}
              >
                Content Performance
              </button>
            </li>
          </ul>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6" role="alert">
            <div className="flex items-center">
              <FaExclamationTriangle className="mr-2 flex-shrink-0" />
              <span className="text-sm sm:text-base">{error}</span>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading && !error && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-red-600"></div>
          </div>
        )}
        
        {/* Content */}
        {!loading && !error && (
          <>
            {activeTab === 'dashboard' && dashboardData && (
              <AnalyticsDashboard data={dashboardData} />
            )}
            
            {activeTab === 'user-engagement' && userEngagementData && (
              <UserEngagementMetrics data={userEngagementData} period={period} />
            )}
            
            {activeTab === 'content-performance' && contentPerformanceData && (
              <ContentPerformanceInsights data={contentPerformanceData} />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
} 