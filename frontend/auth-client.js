/**
 * StyleMuse - Client-side Authentication Helpers
 * Provides token management, authentication state, and automatic token refresh
 */

(function() {
  'use strict';

  // ==========================================
  // Token Storage Management
  // ==========================================

  /**
   * Save authentication token to storage
   * @param {string} token - JWT token
   * @param {boolean} remember - If true, use localStorage; otherwise sessionStorage
   */
  function saveToken(token, remember = false) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', token);
    
    // Clear from the other storage to prevent conflicts
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('token');
    
    // Update global state if available
    if (window.StyleMuse && window.StyleMuse.AppState) {
      window.StyleMuse.AppState.setToken(token);
    }
  }

  /**
   * Get authentication token from storage
   * @returns {string|null} The stored token or null
   */
  function getToken() {
    // Check both storages, preferring localStorage for "remember me"
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  }

  /**
   * Clear authentication token from all storages
   */
  function clearToken() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    
    // Update global state if available
    if (window.StyleMuse && window.StyleMuse.AppState) {
      window.StyleMuse.AppState.clear();
    }
  }

  // ==========================================
  // JWT Token Utilities
  // ==========================================

  /**
   * Decode JWT token payload without verification
   * @param {string} token - JWT token
   * @returns {object|null} Decoded payload or null if invalid
   */
  function decodeToken(token) {
    if (!token) return null;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Decode payload (middle part)
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @param {number} bufferSeconds - Seconds before actual expiry to consider expired
   * @returns {boolean} True if expired or invalid
   */
  function isTokenExpired(token, bufferSeconds = 60) {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return true;
    
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    
    return currentTime >= (expiryTime - bufferSeconds * 1000);
  }

  /**
   * Get time until token expires
   * @param {string} token - JWT token
   * @returns {number} Milliseconds until expiry, or 0 if expired/invalid
   */
  function getTimeUntilExpiry(token) {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return 0;
    
    const expiryTime = payload.exp * 1000;
    const currentTime = Date.now();
    
    return Math.max(0, expiryTime - currentTime);
  }

  /**
   * Get user ID from token
   * @param {string} token - JWT token
   * @returns {number|null} User ID or null
   */
  function getUserIdFromToken(token) {
    const payload = decodeToken(token);
    return payload ? payload.userId : null;
  }

  // ==========================================
  // Authentication State
  // ==========================================

  /**
   * Check if user is authenticated
   * @returns {boolean} True if valid token exists
   */
  function isAuthenticated() {
    const token = getToken();
    if (!token) return false;
    
    // Check if token is expired
    if (isTokenExpired(token)) {
      clearToken();
      return false;
    }
    
    return true;
  }

  /**
   * Get current user from API
   * @returns {Promise<object|null>} User object or null
   */
  async function getCurrentUser() {
    if (!isAuthenticated()) return null;
    
    try {
      const token = getToken();
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          clearToken();
        }
        return null;
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.user) {
        // Cache user in storage
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(data.data.user));
        
        // Update global state if available
        if (window.StyleMuse && window.StyleMuse.AppState) {
          window.StyleMuse.AppState.setUser(data.data.user);
        }
        
        return data.data.user;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Get cached user from storage (synchronous)
   * @returns {object|null} Cached user or null
   */
  function getCachedUser() {
    const userJson = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  // ==========================================
  // Authentication Guards
  // ==========================================

  /**
   * Require authentication - redirect to login if not authenticated
   * @param {string} redirectUrl - URL to redirect to if not authenticated
   * @returns {Promise<boolean>} True if authenticated
   */
  async function requireAuth(redirectUrl = 'login.html') {
    if (!isAuthenticated()) {
      // Save current URL for redirect after login
      sessionStorage.setItem('redirectAfterLogin', window.location.href);
      window.location.href = redirectUrl;
      return false;
    }
    
    // Verify with server
    const user = await getCurrentUser();
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', window.location.href);
      window.location.href = redirectUrl;
      return false;
    }
    
    return true;
  }

  /**
   * Redirect if already authenticated (for login/signup pages)
   * @param {string} redirectUrl - URL to redirect to if authenticated
   * @returns {Promise<boolean>} True if redirected
   */
  async function redirectIfAuthenticated(redirectUrl = 'index.html') {
    if (isAuthenticated()) {
      const user = await getCurrentUser();
      if (user) {
        window.location.href = redirectUrl;
        return true;
      }
    }
    return false;
  }

  // ==========================================
  // Header Attachment
  // ==========================================

  /**
   * Attach authorization header to headers object
   * @param {object} headers - Existing headers object
   * @returns {object} Headers with authorization attached
   */
  function attachAuthHeader(headers = {}) {
    const token = getToken();
    const result = { ...headers };
    
    if (token && !isTokenExpired(token)) {
      result['Authorization'] = `Bearer ${token}`;
    }
    
    // Ensure Content-Type is set for JSON
    if (!result['Content-Type']) {
      result['Content-Type'] = 'application/json';
    }
    
    return result;
  }

  /**
   * Create headers for authenticated API requests
   * @returns {object} Headers object with auth token
   */
  function createAuthHeaders() {
    return attachAuthHeader({
      'Content-Type': 'application/json'
    });
  }

  // ==========================================
  // Automatic Token Refresh
  // ==========================================

  let refreshTimeout = null;
  let isRefreshing = false;

  /**
   * Schedule automatic token refresh before expiry
   * @param {number} refreshBeforeExpiryMs - Milliseconds before expiry to refresh
   */
  function scheduleTokenRefresh(refreshBeforeExpiryMs = 5 * 60 * 1000) {
    // Clear existing timeout
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    
    const token = getToken();
    if (!token) return;
    
    const timeUntilExpiry = getTimeUntilExpiry(token);
    const refreshTime = timeUntilExpiry - refreshBeforeExpiryMs;
    
    if (refreshTime <= 0) {
      // Token already needs refresh or is expired
      handleTokenExpiry();
      return;
    }
    
    // Schedule refresh
    refreshTimeout = setTimeout(() => {
      attemptTokenRefresh();
    }, refreshTime);
    
    console.log(`Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);
  }

  /**
   * Attempt to refresh the token
   * Note: This implementation assumes the server supports token refresh
   * If not, it will handle expiry gracefully
   */
  async function attemptTokenRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    
    try {
      const token = getToken();
      if (!token) {
        handleTokenExpiry();
        return;
      }
      
      // Try to get current user to verify token is still valid
      const user = await getCurrentUser();
      
      if (user) {
        // Token is still valid, reschedule refresh
        scheduleTokenRefresh();
      } else {
        // Token is invalid or expired
        handleTokenExpiry();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      handleTokenExpiry();
    } finally {
      isRefreshing = false;
    }
  }

  /**
   * Handle token expiry - clear storage and optionally redirect
   */
  function handleTokenExpiry() {
    const wasAuthenticated = !!getToken();
    clearToken();
    
    // Dispatch custom event for other parts of the app to handle
    window.dispatchEvent(new CustomEvent('auth:expired', {
      detail: { wasAuthenticated }
    }));
    
    // If on a protected page, redirect to login
    const publicPages = ['login.html', 'share.html', ''];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!publicPages.includes(currentPage) && wasAuthenticated) {
      sessionStorage.setItem('redirectAfterLogin', window.location.href);
      
      // Show a message before redirecting
      if (window.StyleMuse && window.StyleMuse.showToast) {
        window.StyleMuse.showToast('Your session has expired. Please sign in again.', 'warning');
      }
      
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    }
  }

  /**
   * Get redirect URL after login
   * @returns {string|null} URL to redirect to after login
   */
  function getRedirectAfterLogin() {
    const url = sessionStorage.getItem('redirectAfterLogin');
    sessionStorage.removeItem('redirectAfterLogin');
    return url;
  }

  // ==========================================
  // Logout
  // ==========================================

  /**
   * Log out the current user
   * @param {string} redirectUrl - URL to redirect to after logout
   */
  function logout(redirectUrl = 'login.html') {
    // Clear refresh timeout
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    
    // Clear all auth data
    clearToken();
    
    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('auth:logout'));
    
    // Redirect
    window.location.href = redirectUrl;
  }

  // ==========================================
  // Initialize
  // ==========================================

  /**
   * Initialize authentication client
   * - Check token validity
   * - Schedule refresh
   * - Set up event listeners
   */
  function init() {
    const token = getToken();
    
    if (token) {
      if (isTokenExpired(token)) {
        handleTokenExpiry();
      } else {
        // Schedule token refresh
        scheduleTokenRefresh();
        
        // Pre-fetch user data
        getCurrentUser().catch(console.error);
      }
    }
    
    // Listen for storage changes (multi-tab sync)
    window.addEventListener('storage', (event) => {
      if (event.key === 'token') {
        if (!event.newValue) {
          // Token was removed in another tab
          clearToken();
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
          }
        } else if (event.newValue !== event.oldValue) {
          // Token was updated in another tab
          scheduleTokenRefresh();
        }
      }
    });
    
    // Handle visibility change to check token on tab focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const token = getToken();
        if (token && isTokenExpired(token)) {
          handleTokenExpiry();
        }
      }
    });
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==========================================
  // Export to Global Scope
  // ==========================================

  window.AuthClient = {
    // Token management
    saveToken,
    getToken,
    clearToken,
    
    // JWT utilities
    decodeToken,
    isTokenExpired,
    getTimeUntilExpiry,
    getUserIdFromToken,
    
    // Authentication state
    isAuthenticated,
    getCurrentUser,
    getCachedUser,
    
    // Guards
    requireAuth,
    redirectIfAuthenticated,
    
    // Headers
    attachAuthHeader,
    createAuthHeaders,
    
    // Token refresh
    scheduleTokenRefresh,
    attemptTokenRefresh,
    handleTokenExpiry,
    
    // Redirect
    getRedirectAfterLogin,
    
    // Logout
    logout,
    
    // Initialize
    init
  };

  // Also integrate with StyleMuse global if it exists
  if (window.StyleMuse) {
    window.StyleMuse.AuthClient = window.AuthClient;
  }

})();