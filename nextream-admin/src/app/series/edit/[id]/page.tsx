"use client";

import React from "react";
import SeriesForm from "@/components/SeriesForm";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { useParams } from "next/navigation";

export default function EditSeries() {
  const params = useParams();
  const id = params.id as string;

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link
            href={`/series/${id}`}
            className="mr-4 text-slate-400 hover:text-white transition-colors"
          >
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Edit Series
            </h1>
            <p className="text-slate-400 mt-1">
              Update the series details and information
            </p>
          </div>
        </div>
      </div>

      <SeriesForm seriesId={id} isEdit={true} />
    </AdminLayout>
  );
}
