'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import Navbar from '@/components/Navbar';

export default function ApiTest() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const testApi = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Test the API connection
      const response = await api.get('/');
      
      setResult(JSON.stringify(response.data, null, 2));
    } catch (err: any) {
      console.error('API Test Error:', err);
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const testAuthApi = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Test the auth API
      const response = await api.get('/auth/test');
      
      setResult(JSON.stringify(response.data, null, 2));
    } catch (err: any) {
      console.error('Auth API Test Error:', err);
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-white text-3xl font-bold mb-6">API Test Page</h1>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-white text-xl font-semibold mb-4">Test API Connection</h2>
          
          <div className="flex space-x-4 mb-4">
            <button
              onClick={testApi}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
              disabled={loading}
            >
              Test Root API
            </button>
            
            <button
              onClick={testAuthApi}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              disabled={loading}
            >
              Test Auth API
            </button>
          </div>
          
          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/50 text-red-200 p-4 rounded mb-4">
              <h3 className="font-semibold mb-2">Error:</h3>
              <p>{error}</p>
            </div>
          )}
          
          {result && (
            <div className="bg-gray-900 p-4 rounded">
              <h3 className="text-white font-semibold mb-2">Result:</h3>
              <pre className="text-green-400 overflow-x-auto">{result}</pre>
            </div>
          )}
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-white text-xl font-semibold mb-4">API Configuration</h2>
          
          <div className="bg-gray-900 p-4 rounded">
            <h3 className="text-white font-semibold mb-2">Environment Variables:</h3>
            <pre className="text-green-400 overflow-x-auto">
              {`NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || 'Not set'}`}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
} 