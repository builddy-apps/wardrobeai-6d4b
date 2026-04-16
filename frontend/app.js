/**
 * StyleMuse - Shared Client Utilities
 * Provides common functionality used across all pages
 */

// ==========================================
// Global State Management
// ==========================================
const AppState = {
  user: null,
  token: null,
  isLoading: false,
  listeners: new Set(),
  
  setUser(user) {
    this.user = user;
    this.notify();
  },
  
  setToken(token) {
    this.token = token;
    this.notify();
  },
  
  setLoading(loading) {
    this.isLoading = loading;
    this.notify();
  },
  
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  
  notify() {
    this.listeners.forEach(cb => cb(this));
  },
  
  clear() {
    this.user = null;
    this.token = null;
    this.notify();
  }
};

// ==========================================
// Dark Mode Management
// ==========================================
function initDarkMode() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleDark() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

// Initialize dark mode on load
initDarkMode();

// ==========================================
// Token Management
// ==========================================
function saveToken(token, remember = false) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem('token', token);
  AppState.setToken(token);
}

function getToken() {
  if (AppState.token) return AppState.token;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function clearToken() {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  AppState.clear();
}

function isAuthenticated() {
  return !!getToken();
}

// ==========================================
// API Helper Functions
// ==========================================
function getAuthHeaders() {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: getAuthHeaders()
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    
    if (response.status === 401) {
      clearToken();
      window.location.href = 'login.html';
      return null;
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

async function apiGet(url) {
  return apiRequest(url, { method: 'GET' });
}

async function apiPost(url, data) {
  return apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiPut(url, data) {
  return apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiDelete(url) {
  return apiRequest(url, { method: 'DELETE' });
}

// ==========================================
// Toast Notification System
// ==========================================
let toastContainer = null;

function initToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(message, type = 'success', duration = 3000) {
  const container = initToastContainer();
  
  const toast = document.createElement('div');
  toast.className = 'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-up max-w-sm';
  
  let bgColor, textColor, iconColor, iconPath;
  
  switch (type) {
    case 'success':
      bgColor = 'bg-slate-900 dark:bg-white';
      textColor = 'text-white dark:text-slate-900';
      iconColor = 'text-emerald-400 dark:text-emerald-600';
      iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';
      break;
    case 'error':
      bgColor = 'bg-red-600 dark:bg-red-500';
      textColor = 'text-white';
      iconColor = 'text-white';
      iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>';
      break;
    case 'warning':
      bgColor = 'bg-amber-500 dark:bg-amber-400';
      textColor = 'text-white dark:text-amber-950';
      iconColor = 'text-white dark:text-amber-950';
      iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>';
      break;
    case 'info':
      bgColor = 'bg-blue-600 dark:bg-blue-500';
      textColor = 'text-white';
      iconColor = 'text-white';
      iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
      break;
    default:
      bgColor = 'bg-slate-900 dark:bg-white';
      textColor = 'text-white dark:text-slate-900';
      iconColor = 'text-emerald-400 dark:text-emerald-600';
      iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';
  }
  
  toast.classList.add(bgColor, textColor);
  
  toast.innerHTML = `
    <svg class="w-5 h-5 ${iconColor} shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      ${iconPath}
    </svg>
    <span class="text-sm font-medium">${escapeHtml(message)}</span>
    <button onclick="this.parentElement.remove()" class="ml-2 p-1 rounded hover:bg-white/20 transition-colors">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==========================================
// Loading Spinner Component
// ==========================================
function createSpinner(size = 'md') {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };
  
  const spinner = document.createElement('div');
  spinner.className = `${sizeClasses[size]} animate-spin`;
  spinner.innerHTML = `
    <svg class="w-full h-full text-primary-500" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `;
  return spinner;
}

function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-scale-in">
        <div class="spinner-container"></div>
        <p class="text-sm font-medium text-slate-700 dark:text-slate-300 loading-message">${escapeHtml(message)}</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  const spinnerContainer = overlay.querySelector('.spinner-container');
  spinnerContainer.innerHTML = '';
  spinnerContainer.appendChild(createSpinner('xl'));
  overlay.querySelector('.loading-message').textContent = message;
  overlay.classList.remove('hidden');
  
  return overlay;
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// ==========================================
// Image Upload Helper
// ==========================================
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function createImagePreview(file, maxWidth = 300, maxHeight = 300) {
  const dataUrl = await readFileAsDataURL(file);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.8),
        width,
        height,
        originalWidth: img.width,
        originalHeight: img.height
      });
    };
    img.src = dataUrl;
  });
}

function validateImageFile(file, maxSizeMB = 10) {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' };
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit.` };
  }
  
  return { valid: true };
}

// ==========================================
// Debounce Utility
// ==========================================
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==========================================
// Throttle Utility
// ==========================================
function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ==========================================
// Smooth Scroll Behavior
// ==========================================
function smoothScrollTo(element, offset = 0) {
  const target = typeof element === 'string' ? document.querySelector(element) : element;
  if (!target) return;
  
  const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({
    top,
    behavior: 'smooth'
  });
}

function smoothScrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// ==========================================
// Page Transition Animations
// ==========================================
function animatePageIn() {
  const elements = document.querySelectorAll('[data-animate]');
  elements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      el.style.transition = 'all 0.4s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, index * 50);
  });
}

function animatePageOut(callback) {
  const content = document.querySelector('main');
  if (content) {
    content.style.transition = 'all 0.3s ease-out';
    content.style.opacity = '0';
    content.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
      if (callback) callback();
    }, 300);
  } else if (callback) {
    callback();
  }
}

// ==========================================
// HTML Escape Utility
// ==========================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// Date Formatting Utilities
// ==========================================
function formatDate(date, options = {}) {
  const defaultOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };
  return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  
  return formatDate(date);
}

// ==========================================
// URL Parameter Utilities
// ==========================================
function getUrlParams() {
  return new URLSearchParams(window.location.search);
}

function getUrlParam(key) {
  return getUrlParams().get(key);
}

function setUrlParam(key, value) {
  const params = getUrlParams();
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, '', newUrl);
}

// ==========================================
// Local Storage Helpers
// ==========================================
function getStorageItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

function removeStorageItem(key) {
  localStorage.removeItem(key);
}

// ==========================================
// User Session Helpers
// ==========================================
async function getCurrentUser() {
  if (AppState.user) return AppState.user;
  
  if (!isAuthenticated()) return null;
  
  try {
    const response = await apiGet('/api/auth/me');
    if (response && response.success) {
      AppState.setUser(response.data.user);
      return response.data.user;
    }
  } catch (error) {
    console.error('Failed to get current user:', error);
  }
  
  return null;
}

async function requireAuth(redirectUrl = 'login.html') {
  if (!isAuthenticated()) {
    window.location.href = redirectUrl;
    return false;
  }
  
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return false;
  }
  
  return true;
}

function logout() {
  clearToken();
  window.location.href = 'login.html';
}

// ==========================================
// Event Helpers
// ==========================================
function onReady(callback) {
  if (document.readyState !== 'loading') {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

function onClickOutside(element, callback) {
  document.addEventListener('click', (event) => {
    if (!element.contains(event.target)) {
      callback(event);
    }
  });
}

// ==========================================
// CSS Animation Classes (inject styles)
// ==========================================
function injectAnimationStyles() {
  const styleId = 'app-js-animations';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-down {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-left {
      from { opacity: 0; transform: translateX(24px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slide-right {
      from { opacity: 0; transform: translateX(-24px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes pulse-soft {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
    .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
    .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
    .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
    .animate-slide-left { animation: slide-left 0.4s ease-out forwards; }
    .animate-slide-right { animation: slide-right 0.4s ease-out forwards; }
    .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
    .animate-float { animation: float 3s ease-in-out infinite; }
    .stagger-1 { animation-delay: 0.05s; opacity: 0; }
    .stagger-2 { animation-delay: 0.1s; opacity: 0; }
    .stagger-3 { animation-delay: 0.15s; opacity: 0; }
    .stagger-4 { animation-delay: 0.2s; opacity: 0; }
    .stagger-5 { animation-delay: 0.25s; opacity: 0; }
  `;
  document.head.appendChild(style);
}

// Inject styles on load
injectAnimationStyles();

// ==========================================
// Export for use in other scripts
// ==========================================
window.StyleMuse = {
  // State
  AppState,
  
  // Dark mode
  toggleDark,
  isDarkMode,
  initDarkMode,
  
  // Auth
  saveToken,
  getToken,
  clearToken,
  isAuthenticated,
  getCurrentUser,
  requireAuth,
  logout,
  
  // API
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiRequest,
  getAuthHeaders,
  
  // Toast
  showToast,
  
  // Loading
  createSpinner,
  showLoadingOverlay,
  hideLoadingOverlay,
  
  // Image
  readFileAsDataURL,
  createImagePreview,
  validateImageFile,
  
  // Utilities
  debounce,
  throttle,
  smoothScrollTo,
  smoothScrollToTop,
  animatePageIn,
  animatePageOut,
  escapeHtml,
  formatDate,
  formatRelativeTime,
  getUrlParams,
  getUrlParam,
  setUrlParam,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  onReady,
  onClickOutside
};