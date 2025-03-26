"use client";

import React from "react";
import SeriesForm from "@/components/SeriesForm";
import FuturisticAdminCard from "@/components/FuturisticAdminCard";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { FaArrowLeft, FaFilm } from "react-icons/fa";

export default function NewSeries() {
  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link
            href="/series"
            className="mr-4 text-slate-400 hover:text-white transition-colors"
          >
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Add New Series
            </h1>
            <p className="text-slate-400 mt-1">
              Create a new TV series in your streaming library
            </p>
          </div>
        </div>
      </div>

      <SeriesForm />
    </AdminLayout>
  );
}
