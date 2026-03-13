"use client";

import { Calendar, Users, FileText, Settings } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Smart Masjeedh</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">mohammedjunain@gmail.com</span>
              <button className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-700">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, mohammedjunain!
          </h2>
          <p className="text-gray-600">
            You are logged in as <span className="font-semibold">Super Admin</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            href="/events"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-emerald-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">Events</h3>
            <p className="text-sm text-gray-600 mt-1">Create and manage events</p>
          </Link>

          <Link
            href="/families"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">Families</h3>
            <p className="text-sm text-gray-600 mt-1">Manage family records</p>
          </Link>

          <Link
            href="/members"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-purple-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">Members</h3>
            <p className="text-sm text-gray-600 mt-1">Manage member records</p>
          </Link>

          <Link
            href="/settings"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Settings className="w-8 h-8 text-gray-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">Settings</h3>
            <p className="text-sm text-gray-600 mt-1">System settings</p>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  );
}
