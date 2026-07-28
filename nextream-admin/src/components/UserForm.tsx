"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import FileUpload from "./FileUpload";
import { IMAGE_ACCEPT } from "@/lib/mediaAccept";
import { FaSave, FaTimes, FaSpinner } from "react-icons/fa";

interface UserFormProps {
  userId: string;
  isEdit?: boolean;
}

interface UserFormData {
  username: string;
  email: string;
  profilePic: string;
  isAdmin: boolean;
  password: string;
}

const initialUserData: UserFormData = {
  username: "",
  email: "",
  profilePic: "",
  isAdmin: false,
  password: "",
};

const UserForm = ({ userId, isEdit = true }: UserFormProps) => {
  const [userData, setUserData] = useState<UserFormData>(initialUserData);
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isEdit && userId) {
      const fetchUser = async () => {
        try {
          setLoading(true);
          const res = await api.get(`/users/find/${userId}`, {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          });
          setUserData({
            username: res.data.username || "",
            email: res.data.email || "",
            profilePic: res.data.profilePic || "",
            isAdmin: Boolean(res.data.isAdmin),
            password: "",
          });
        } catch (err) {
          setError("Failed to load user data");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      fetchUser();
    }
  }, [isEdit, userId, user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checkbox = e.target as HTMLInputElement;
      setUserData({ ...userData, [name]: checkbox.checked });
    } else {
      setUserData({ ...userData, [name]: value });
    }
  };

  const handleFileUpload = (key: string) => {
    setUserData({ ...userData, profilePic: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to perform this action");
      return;
    }

    if (!userData.username || !userData.email) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const payload: Record<string, string | boolean> = {
        username: userData.username,
        email: userData.email,
        profilePic: userData.profilePic,
        isAdmin: userData.isAdmin,
      };

      if (userData.password.trim()) {
        payload.password = userData.password;
      }

      await api.put(`/users/${userId}`, payload, {
        headers: {
          token: `Bearer ${user.accessToken}`,
        },
      });

      setSuccess("User updated successfully");
      setTimeout(() => {
        router.push(`/users/${userId}`);
      }, 800);
    } catch (err: any) {
      console.error("Error saving user:", err.response?.data || err.message);
      setError(
        err.response?.data?.message ||
          err.response?.data ||
          "Failed to save user"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg shadow-md p-6">
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {success && (
        <div
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline"> {success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={userData.username}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={userData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={userData.password}
              onChange={handleChange}
              placeholder="Leave blank to keep current password"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty to keep the current password unchanged.
            </p>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isAdmin"
                checked={userData.isAdmin}
                onChange={handleChange}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-border rounded"
              />
              <span className="ml-2 text-sm text-muted-foreground">
                Administrator privileges
              </span>
            </label>
          </div>
        </div>

        <div>
          <FileUpload
            label="Profile Picture"
            onFileUpload={(key) => handleFileUpload(key)}
            accept={IMAGE_ACCEPT}
            prefix="avatars"
            existingUrl={userData.profilePic}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center px-4 py-2 border border-input shadow-sm text-sm font-medium rounded-md text-muted-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <FaTimes className="-ml-1 mr-2 h-4 w-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <FaSpinner className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Saving...
            </>
          ) : (
            <>
              <FaSave className="-ml-1 mr-2 h-4 w-4" />
              Update User
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
