"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, Plus } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Events</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Events Management</h2>
          <p className="text-gray-600 mb-6">
            Create and manage masjid events.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Calendar className="w-8 h-8 text-emerald-600 mr-3" />
                <h3 className="font-semibold text-gray-900">Create Event</h3>
              </div>
              <p className="text-sm text-gray-600">Add new events to your masjid calendar</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Calendar className="w-8 h-8 text-blue-600 mr-3" />
                <h3 className="font-semibold text-gray-900">Upcoming Events</h3>
              </div>
              <p className="text-sm text-gray-600">View and manage upcoming events</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Plus className="w-8 h-8 text-purple-600 mr-3" />
                <h3 className="font-semibold text-gray-900">Event Templates</h3>
              </div>
              <p className="text-sm text-gray-600">Create reusable event templates</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
