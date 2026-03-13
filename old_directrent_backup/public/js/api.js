const API_BASE = '/api';

function getToken() { return localStorage.getItem('dr_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('dr_user')); } catch { return null; } }
function setAuth(token, user) { localStorage.setItem('dr_token', token); localStorage.setItem('dr_user', JSON.stringify(user)); }
function clearAuth() { localStorage.removeItem('dr_token'); localStorage.removeItem('dr_user'); }

function logout() {
  clearAuth();
  window.location.href = '/pages/login.html';
}

function requireAuth(allowedRoles = []) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) { window.location.href = '/pages/login.html'; return null; }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    alert('Access denied: You do not have permission to view this page.');
    window.location.href = '/';
    return null;
  }
  return user;
}

async function apiCall(method, endpoint, body = null, isFormData = false) {
  const headers = { 'Authorization': `Bearer ${getToken()}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body) options.body = isFormData ? body : JSON.stringify(body);

  try {
    const res = await fetch(API_BASE + endpoint, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    throw err;
  }
}

const api = {
  get: (endpoint) => apiCall('GET', endpoint),
  post: (endpoint, body) => apiCall('POST', endpoint, body),
  put: (endpoint, body) => apiCall('PUT', endpoint, body),
  delete: (endpoint) => apiCall('DELETE', endpoint),
};

function fmtCurrency(amount) {
  return '₦' + parseFloat(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-lg ${bgColor} transform transition-all duration-300`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function showLoading(el, text = 'Loading...') {
  el.innerHTML = `<div class="flex items-center justify-center py-12"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div><span class="ml-3 text-gray-600">${text}</span></div>`;
}

function statusBadge(status) {
  const colors = {
    active: 'bg-green-100 text-green-800', verified: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800', flagged: 'bg-orange-100 text-orange-800',
    removed: 'bg-red-100 text-red-800', rejected: 'bg-red-100 text-red-800',
    open: 'bg-blue-100 text-blue-800', resolved: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-purple-100 text-purple-800', draft: 'bg-gray-100 text-gray-800',
    published: 'bg-green-100 text-green-800', free: 'bg-green-100 text-green-800',
    used: 'bg-gray-100 text-gray-800', completed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800'
  };
  const color = colors[status] || 'bg-gray-100 text-gray-800';
  return `<span class="px-2 py-1 rounded-full text-xs font-medium ${color}">${status}</span>`;
}

function getDashboardLink(role) {
  const links = {
    tenant: '/pages/dashboard-tenant.html',
    landlord: '/pages/dashboard-landlord.html',
    agent: '/pages/dashboard-agent.html',
    lawyer: '/pages/dashboard-lawyer.html',
    admin: '/pages/dashboard-admin.html'
  };
  return links[role] || '/';
}

function renderNav(user) {
  const nav = document.getElementById('nav-menu');
  if (!nav || !user) return;
  nav.innerHTML = `
    <a href="${getDashboardLink(user.role)}" class="text-white hover:text-green-200 transition">Dashboard</a>
    <a href="/pages/properties.html" class="text-white hover:text-green-200 transition">Properties</a>
    <a href="/pages/blog.html" class="text-white hover:text-green-200 transition">Blog</a>
    <a href="/pages/support.html" class="text-white hover:text-green-200 transition">Support</a>
    <span class="text-green-200 font-medium">${user.name}</span>
    <button onclick="logout()" class="bg-white text-green-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50 transition">Logout</button>
  `;
}
