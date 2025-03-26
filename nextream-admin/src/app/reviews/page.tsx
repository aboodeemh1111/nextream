"use client";

import { useState } from "react";
import {
  FaComment,
  FaCheck,
  FaTimes,
  FaChartBar,
  FaExclamationTriangle,
  FaFilter,
  FaChartLine,
} from "react-icons/fa";
import ReviewsTable from "@/components/reviews/ReviewsTable";
import ReviewStats from "@/components/reviews/ReviewStats";
import { useAuth } from "@/context/AuthContext";
import FuturisticAdminCard from "@/components/FuturisticAdminCard";
import FuturisticAdminButton from "@/components/FuturisticAdminButton";

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "stats"
  >("all");
  const { user } = useAuth();

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FuturisticAdminCard
          className="max-w-md w-full"
          title="Access Denied"
          icon={<FaExclamationTriangle />}
          glowColor="purple"
        >
          <p className="text-slate-300 mt-2">
            You do not have permission to access this page. Please log in with
            an admin account.
          </p>
        </FuturisticAdminCard>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Review Management
            </h1>
            <p className="text-slate-400 mt-1">
              Monitor and manage user reviews for your streaming content
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="flex space-x-2">
              <FuturisticAdminButton
                size="sm"
                variant="secondary"
                icon={<FaChartLine />}
              >
                Generate Report
              </FuturisticAdminButton>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-slate-700/50 flex overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("all")}
            className={`${
              activeTab === "all"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
            } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
          >
            <FaComment className="mr-2" />
            All Reviews
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`${
              activeTab === "pending"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
            } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
          >
            <FaTimes className="mr-2" />
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`${
              activeTab === "approved"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
            } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
          >
            <FaCheck className="mr-2" />
            Approved
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`${
              activeTab === "stats"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
            } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
          >
            <FaChartBar className="mr-2" />
            Statistics
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      <div>
        {activeTab === "all" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-slate-200">
                All Reviews
              </h2>
              <FuturisticAdminButton
                size="sm"
                variant="secondary"
                icon={<FaFilter />}
              >
                Filter
              </FuturisticAdminButton>
            </div>
            <ReviewsTable
              filter="all"
              onReviewUpdated={() => {
                // Force refresh if needed
              }}
            />
          </div>
        )}

        {activeTab === "pending" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-slate-200">
                Pending Reviews
              </h2>
              <div className="flex space-x-2">
                <FuturisticAdminButton
                  size="sm"
                  variant="success"
                  icon={<FaCheck />}
                >
                  Approve All
                </FuturisticAdminButton>
                <FuturisticAdminButton
                  size="sm"
                  variant="secondary"
                  icon={<FaFilter />}
                >
                  Filter
                </FuturisticAdminButton>
              </div>
            </div>
            <ReviewsTable
              filter="pending"
              onReviewUpdated={() => {
                // Force refresh if needed
              }}
            />
          </div>
        )}

        {activeTab === "approved" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-slate-200">
                Approved Reviews
              </h2>
              <FuturisticAdminButton
                size="sm"
                variant="secondary"
                icon={<FaFilter />}
              >
                Filter
              </FuturisticAdminButton>
            </div>
            <ReviewsTable
              filter="approved"
              onReviewUpdated={() => {
                // Force refresh if needed
              }}
            />
          </div>
        )}

        {activeTab === "stats" && (
          <div>
            <h2 className="text-lg font-medium text-slate-200 mb-4">
              Review Statistics
            </h2>
            <ReviewStats />
          </div>
        )}
      </div>
    </div>
  );
}
