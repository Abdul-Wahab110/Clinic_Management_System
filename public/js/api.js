/**
 * AuraCare Medical Center - API Client Utility
 * Centralized Fetch wrapper with error handling & JWT authorization
 */
const API = (() => {
  const isDevOtherPort = typeof window !== 'undefined' && 
    (window.location.protocol === 'file:' || (['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '5000' && window.location.port !== ''));
  const BASE_URL = isDevOtherPort ? 'http://localhost:5000/api/v1' : '/api/v1';

  function getToken() {
    return localStorage.getItem('auth_token');
  }

  function setToken(token) {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }

  function clearAuth() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') || endpoint.startsWith('/api') 
      ? endpoint 
      : `${BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };

    const token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({
        success: false,
        message: response.statusText || 'Failed to parse response JSON.'
      }));

      if (!response.ok) {
        // Handle Session Expiration / Unauthorized
        if (response.status === 401 && !url.includes('/auth/login')) {
          clearAuth();
          if (window.location.pathname.startsWith('/pages/') || window.location.pathname.includes('dashboard')) {
            window.location.href = `/pages/login.html?session_expired=1&redirect=${encodeURIComponent(window.location.pathname)}`;
          }
        }

        const error = new Error(data.message || `HTTP Error ${response.status}`);
        error.statusCode = response.status;
        error.data = data;
        error.errors = data.errors || [];
        error.errorCode = data.errorCode || 'API_ERROR';
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[API ERROR] ${options.method || 'GET'} ${url}:`, err);
      throw err;
    }
  }

  return {
    get: (url, params = null) => {
      let finalUrl = url;
      if (params) {
        const search = new URLSearchParams();
        Object.keys(params).forEach(k => {
          if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
            search.append(k, params[k]);
          }
        });
        const query = search.toString();
        if (query) finalUrl += `?${query}`;
      }
      return request(finalUrl, { method: 'GET' });
    },
    post: (url, body) => request(url, { method: 'POST', body }),
    put: (url, body) => request(url, { method: 'PUT', body }),
    patch: (url, body) => request(url, { method: 'PATCH', body }),
    delete: (url) => request(url, { method: 'DELETE' }),
    getToken,
    setToken,
    clearAuth,
    checkHealth: () => request('/api/health')
  };
})();

window.API = API;
