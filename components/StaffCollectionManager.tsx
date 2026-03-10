"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { DollarSign, Users, Calendar, TrendingUp, AlertCircle, X } from "lucide-react";

type Collection = {
  id: string;
  collection_amount: number;
  commission_percent: number;
  commission_amount: number;
  collection_date: string;
  status: string;
  member_name?: string;
  subscription_type?: string;
};

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  commission_percent: number;
  salary_amount: number;
  salary_type: string;
};

export function StaffCollectionManager() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ctx, setCtx] = useState<any>(null);

  // Form states
  const [newCollectionAmount, setNewCollectionAmount] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const initializeData = async () => {
      try {
        const tenantContext = await getTenantContext();
        setCtx(tenantContext);
        await loadData(tenantContext.masjidId);
      } catch (error) {
        console.error("Error initializing StaffCollectionManager:", error);
        setLoading(false);
      }
    };
    initializeData();
  }, []);

  const loadData = async (masjidId: string) => {
    try {
      // Load staff members
      const { data: staffData } = await supabase
        .from("employees")
        .select("id, full_name, email, commission_percent, salary_amount, salary_type")
        .eq("masjid_id", masjidId)
        .eq("status", "active")
        .order("full_name");

      setStaff(staffData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const loadStaffCollections = async (staffId: string) => {
    if (!ctx) return;

    try {
      const currentMonth = new Date();
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data } = await supabase
        .from("collections")
        .select(`
          id,
          collection_amount,
          commission_percent,
          commission_amount,
          collection_date,
          status,
          members(full_name),
          subscriptions(subscription_type)
        `)
        .eq("employee_id", staffId)
        .eq("masjid_id", ctx.masjidId)
        .gte("collection_date", monthStart.toISOString())
        .lte("collection_date", monthEnd.toISOString())
        .order("collection_date", { ascending: false });

      setCollections(data?.map((c: any) => ({
        ...c,
        member_name: c.members?.full_name,
        subscription_type: c.subscriptions?.subscription_type
      })) || []);
    } catch (error) {
      console.error("Error loading collections:", error);
    }
  };

  const handleSelectStaff = (staffMember: StaffMember) => {
    setSelectedStaff(staffMember);
    loadStaffCollections(staffMember.id);
  };

  const handleAddCollection = async () => {
    try {
      if (!ctx || !selectedStaff) {
        alert("Please select a staff member first");
        return;
      }

      if (!newCollectionAmount || parseFloat(newCollectionAmount) <= 0) {
        alert("Please enter a valid collection amount");
        return;
      }

      const response = await fetch('/api/collections/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: selectedMember,
          collection_amount: parseFloat(newCollectionAmount),
          payment_method: paymentMethod,
          notes: notes
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add collection');
      }

      alert(`Collection of ₹${newCollectionAmount} recorded successfully!`);
      
      // Reset form
      setNewCollectionAmount("");
      setSelectedMember("");
      setPaymentMethod("cash");
      setNotes("");
      setShowAddModal(false);

      // Reload collections
      loadStaffCollections(selectedStaff.id);
      
    } catch (error) {
      console.error("Error adding collection:", error);
      alert("Failed to add collection: " + (error as Error).message);
    }
  };

  const calculateMonthlyStats = () => {
    if (!collections.length) return { totalCollected: 0, totalCommission: 0 };

    const totalCollected = collections.reduce((sum, c) => sum + c.collection_amount, 0);
    const totalCommission = collections.reduce((sum, c) => sum + c.commission_amount, 0);

    return { totalCollected, totalCommission };
  };

  if (loading) return <div>Loading staff collection management...</div>;

  const { totalCollected, totalCommission } = calculateMonthlyStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Staff Collection Management
          </h2>
          <p className="text-gray-600 mt-1">Manage staff collections and commission tracking</p>
        </div>
      </div>

      {/* Staff Selection */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-lg">Select Staff Member</h3>
          <p className="text-sm text-gray-600 mt-1">Choose a staff member to view and manage their collections</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((staffMember) => (
              <div
                key={staffMember.id}
                onClick={() => handleSelectStaff(staffMember)}
                className={`border rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                  selectedStaff?.id === staffMember.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{staffMember.full_name}</h4>
                    <p className="text-sm text-gray-600">{staffMember.email}</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Commission:</span>
                  <span className="font-medium">{staffMember.commission_percent}%</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Salary:</span>
                  <span className="font-medium">₹{staffMember.salary_amount} ({staffMember.salary_type})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Staff Details */}
      {selectedStaff && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{selectedStaff.full_name}</h3>
                <p className="text-sm text-gray-600 mt-1">Collection Details and Commission Tracking</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Add Collection
              </button>
            </div>
          </div>
          
          {/* Monthly Stats */}
          <div className="p-6 border-b">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{collections.length}</div>
                <div className="text-sm text-gray-600">Total Collections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">₹{totalCollected.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Collected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">₹{totalCommission.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Commission</div>
              </div>
            </div>
          </div>

          {/* Collections List */}
          <div className="p-6">
            <h4 className="font-medium mb-4">Recent Collections</h4>
            {collections.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No collections this month</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-3 text-green-600 hover:text-green-700 font-medium"
                >
                  Add First Collection
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {collections.map((collection) => (
                  <div key={collection.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">₹{collection.collection_amount.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">
                          {collection.member_name} • {collection.subscription_type}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(collection.collection_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-purple-600">
                          ₹{collection.commission_amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {collection.commission_percent}% commission
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full mt-1 ${
                          collection.status === 'approved' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {collection.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Commission Calculation Policy</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Commission calculated only from collected amounts</li>
              <li>• Not calculated from monthly salary</li>
              <li>• Commission added to monthly earnings</li>
              <li>• Only one staff member can collect at a time</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Collection Modal */}
      {showAddModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add Collection</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-green-800">
                  💰 Adding collection for <strong>{selectedStaff.full_name}</strong>
                  <br />
                  Commission: {selectedStaff.commission_percent}% of collected amount
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Collection Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newCollectionAmount}
                  onChange={(e) => setNewCollectionAmount(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  <div>Collection Amount: ₹{newCollectionAmount || '0.00'}</div>
                  <div>Commission ({selectedStaff.commission_percent}%): ₹{newCollectionAmount ? (parseFloat(newCollectionAmount) * selectedStaff.commission_percent / 100).toFixed(2) : '0.00'}</div>
                </div>
              </div>

              <button
                onClick={handleAddCollection}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all"
              >
                Add Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
