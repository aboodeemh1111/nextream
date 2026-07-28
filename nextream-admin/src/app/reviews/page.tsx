"use client";

import { useState } from "react";
import { FaComment, FaCheck, FaTimes, FaChartBar } from "react-icons/fa";
import AdminLayout from "@/components/AdminLayout";
import ReviewsTable from "@/components/reviews/ReviewsTable";
import ReviewStats from "@/components/reviews/ReviewStats";
import { useAuth } from "@/context/AuthContext";

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "stats"
  >("all");
  const { user } = useAuth();

  if (!user || !user.isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-16">
          <div className="bg-card border border-border p-8 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-red-500 mb-4">
              Access Denied
            </h1>
            <p className="text-muted-foreground">
              You do not have permission to access this page.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="px-2 sm:px-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-4 md:mb-0">
            User Reviews Management
          </h1>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("all")}
                className={`${
                  activeTab === "all"
                    ? "border-red-500 text-red-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaComment className="mr-2" />
                All Reviews
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`${
                  activeTab === "pending"
                    ? "border-yellow-500 text-yellow-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaTimes className="mr-2" />
                Pending Approval
              </button>
              <button
                onClick={() => setActiveTab("approved")}
                className={`${
                  activeTab === "approved"
                    ? "border-green-500 text-green-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaCheck className="mr-2" />
                Approved
              </button>
              <button
                onClick={() => setActiveTab("stats")}
                className={`${
                  activeTab === "stats"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <FaChartBar className="mr-2" />
                Statistics
              </button>
            </nav>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="bg-card border border-border shadow rounded-lg">
          {activeTab === "all" && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-foreground mb-4">
                All Reviews
              </h2>
              <ReviewsTable
                filter="all"
                onReviewUpdated={() => {
                  // Force refresh if needed
                }}
              />
            </div>
          )}

          {activeTab === "pending" && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-foreground mb-4">
                Pending Reviews
              </h2>
              <ReviewsTable
                filter="pending"
                onReviewUpdated={() => {
                  // Force refresh if needed
                }}
              />
            </div>
          )}

          {activeTab === "approved" && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-foreground mb-4">
                Approved Reviews
              </h2>
              <ReviewsTable
                filter="approved"
                onReviewUpdated={() => {
                  // Force refresh if needed
                }}
              />
            </div>
          )}

          {activeTab === "stats" && (
            <div className="p-6">
              <h2 className="text-lg font-medium text-foreground mb-4">
                Review Statistics
              </h2>
              <ReviewStats />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
