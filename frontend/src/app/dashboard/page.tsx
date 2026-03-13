'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return <div>Loading...</div>;
  }

  const renderDashboard = () => {
    switch (user?.role) {
      case 'tenant':
        return <TenantDashboard />;
      case 'landlord':
        return <LandlordDashboard />;
      case 'agent':
        return <AgentDashboard />;
      case 'admin':
      case 'super_admin':
      case 'sub_admin':
        return <AdminDashboard />;
      default:
        return <div>Dashboard not available for your role.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-gray-800 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">KudiRent Dashboard</h1>
        <div className="flex items-center space-x-4">
          <span>{user?.name} ({user?.role})</span>
          <span>Wallet: ₦{user?.wallet_balance}</span>
          <button onClick={() => router.push('/')} className="bg-primary text-black px-4 py-2 rounded">Home</button>
        </div>
      </header>
      <main className="container mx-auto p-4">
        {renderDashboard()}
      </main>
    </div>
  );
}

function TenantDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tenant Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">My Rentals</h3>
          <p>View your current and past rentals</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Payment History</h3>
          <p>Track your rent payments</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Wallet</h3>
          <p>Deposit funds and manage balance</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Support Tickets</h3>
          <p>Create and track support requests</p>
        </div>
      </div>
    </div>
  );
}

function LandlordDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Landlord Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">My Properties</h3>
          <p>Manage your property listings</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Tenant Requests</h3>
          <p>Review and accept tenant applications</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Earnings</h3>
          <p>Track rent payments and earnings</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Reviews</h3>
          <p>View property ratings and feedback</p>
        </div>
      </div>
    </div>
  );
}

function AgentDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Agent Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Commission Earned</h3>
          <p>Total: ₦0.00</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Referred Properties</h3>
          <p>Track properties you've referred</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Referral Code</h3>
          <p>Share your unique referral code</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Withdrawals</h3>
          <p>Request commission withdrawals</p>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">User Management</h3>
          <p>Manage all users and roles</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Property Approvals</h3>
          <p>Approve and verify property listings</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">KYC Management</h3>
          <p>Review and approve KYC submissions</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Support Tickets</h3>
          <p>Handle user support requests</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Transaction Logs</h3>
          <p>Monitor all platform transactions</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-xl font-semibold mb-2">Reviews & Ratings</h3>
          <p>Manage property reviews and ratings</p>
        </div>
      </div>
    </div>
  );
}