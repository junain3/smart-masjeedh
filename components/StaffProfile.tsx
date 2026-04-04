"use client";

import { useState } from "react";
import { X, Users, DollarSign, Briefcase, Settings, Calendar } from "lucide-react";
import type { Staff } from "@/app/staff/page";

interface StaffProfileProps {
  staff: Staff;
  staffBalances: {[key: string]: number};
  onClose: () => void;
  onSave: (updatedStaff: Staff) => void;
  getStatusColor: (status: string) => string;
  getPermissionLabel: (key: string) => string;
}

export default function StaffProfile({
  staff,
  staffBalances,
  onClose,
  onSave,
  getStatusColor,
  getPermissionLabel
}: StaffProfileProps) {
  const [profileCommissionRate, setProfileCommissionRate] = useState((staff.commission_rate || 10).toString());
  const [profileEnableCollection, setProfileEnableCollection] = useState(staff.enable_collection || false);

  const [activeTab, setActiveTab] = useState('overview');

  const handleSave = () => {
    const updatedStaff: Staff = {
      ...staff,
      commission_rate: Number(profileCommissionRate),
      enable_collection: profileEnableCollection,
      permissions: {
        ...staff.permissions,
        subscriptions_collect: profileEnableCollection
      }
    };
    onSave(updatedStaff);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header with Green Gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 -mx-6 -mt-6 px-6 pt-6 pb-8 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold">{staff.name}</h2>
                <p className="text-emerald-100 capitalize">{staff.role.replace('_', ' ')}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:bg-emerald-500 p-2 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6 bg-neutral-100 rounded-2xl p-1">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Profile Overview
            </button>
            <button 
              onClick={() => setActiveTab('commission')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-colors ${
                activeTab === 'commission' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Commission Details
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Settings
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information Card */}
            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-emerald-600" />
                Personal Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Full Name</p>
                  <p className="text-sm font-medium text-neutral-900">{staff.name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Email Address</p>
                  <p className="text-sm font-medium text-neutral-900">{staff.email}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Phone Number</p>
                  <p className="text-sm font-medium text-neutral-900">{staff.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Staff Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(staff.status)}`}>
                    {staff.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Salary & Commission Card */}
            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
                Financial Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Basic Salary</p>
                  <p className="text-lg font-bold text-emerald-700">Rs. {staff.basic_salary.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Commission Rate</p>
                  <p className="text-lg font-bold text-emerald-700">{staff.commission_rate || 10}%</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Available Commission</p>
                  <p className="text-lg font-bold text-emerald-700">Rs. {(staffBalances[staff.user_id || ''] || 0).toLocaleString()}</p>
                </div>
                <div className="pt-3 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500 mb-1">Total Payable This Month</p>
                  <p className="text-xl font-black text-emerald-700">
                    Rs. {(staff.basic_salary + (staffBalances[staff.user_id || ''] || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Job Responsibilities Card */}
            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-emerald-600" />
                Job Responsibilities
              </h3>
              <div className="space-y-2">
                {profileEnableCollection ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <p className="text-sm text-neutral-700">Subscription Collection</p>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-neutral-300 rounded-full"></div>
                    <p className="text-sm text-neutral-500">No Collection Permission</p>
                  </div>
                )}
                {Object.entries(staff.permissions || {}).filter(([_, value]) => value).map(([key]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <p className="text-sm text-neutral-700">{getPermissionLabel(key)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Collection Settings Card */}
            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-emerald-600" />
                Collection Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-700">Enable Collection</p>
                    <p className="text-xs text-neutral-500">Allow subscription collection</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileEnableCollection}
                      onChange={(e) => setProfileEnableCollection(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                
                {profileEnableCollection && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={profileCommissionRate}
                      onChange={(e) => setProfileCommissionRate(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="10"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {activeTab === 'commission' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Commission Overview Card */}
              <div className="bg-neutral-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-emerald-600" />
                  Commission Overview
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Current Commission Rate</p>
                    <p className="text-lg font-bold text-emerald-700">{staff.commission_rate || 10}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Available Commission</p>
                    <p className="text-lg font-bold text-emerald-700">Rs. {(staffBalances[staff.user_id || ''] || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Collection Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      staff.enable_collection ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-800'
                    }`}>
                      {staff.enable_collection ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Commission History Card */}
              <div className="bg-neutral-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-emerald-600" />
                  Commission History
                </h3>
                <div className="space-y-3">
                  <div className="text-center py-8 text-neutral-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                    <p className="text-sm">No commission history yet</p>
                    <p className="text-xs mt-1">Commission will be credited when collections are accepted</p>
                  </div>
                </div>
              </div>

              {/* Commission Settings Card */}
              <div className="bg-neutral-50 rounded-2xl p-6 md:col-span-2">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-emerald-600" />
                  Commission Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-700">Enable Collection</p>
                      <p className="text-xs text-neutral-500">Allow this staff member to collect subscriptions</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileEnableCollection}
                        onChange={(e) => setProfileEnableCollection(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  
                  {profileEnableCollection && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={profileCommissionRate}
                        onChange={(e) => setProfileCommissionRate(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="10"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Settings Card */}
              <div className="bg-neutral-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-emerald-600" />
                  Account Settings
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Staff ID</p>
                    <p className="text-sm font-medium text-neutral-900">{staff.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">User ID</p>
                    <p className="text-sm font-medium text-neutral-900">{staff.user_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Account Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(staff.status)}`}>
                      {staff.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Role Level</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      staff.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                      staff.role === 'co_admin' ? 'bg-blue-100 text-blue-800' :
                      staff.role === 'staff' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {staff.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Permissions Overview Card */}
              <div className="bg-neutral-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-emerald-600" />
                  Permissions Overview
                </h3>
                <div className="space-y-2">
                  {Object.entries(staff.permissions || {}).filter(([_, value]) => value).map(([key]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <span className="text-sm text-neutral-700">{getPermissionLabel(key)}</span>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    </div>
                  ))}
                  {Object.entries(staff.permissions || {}).filter(([_, value]) => value).length === 0 && (
                    <div className="text-center py-4 text-neutral-500">
                      <p className="text-sm">No special permissions assigned</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-neutral-200">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-neutral-200 rounded-2xl font-medium hover:bg-neutral-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
