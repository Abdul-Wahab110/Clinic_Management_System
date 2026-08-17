/**
 * AuraCare Centralized Hospital Settings Client Service
 * Dynamically loads and binds MySQL-configured hospital settings across all HTML pages
 */
const HospitalSettings = {
  _cache: null,

  async load(forceRefresh = false) {
    if (this._cache && !forceRefresh) {
      this.applyToDOM(this._cache);
      return this._cache;
    }

    try {
      const res = await API.get('/settings/public');
      if (res.success && res.data) {
        this._cache = res.data;
        this.applyToDOM(res.data);
        return this._cache;
      }
    } catch (err) {
      console.warn('⚠️ Could not load remote hospital settings, using fallback.', err);
    }

    // Fallback defaults
    this._cache = {
      hospital_name: 'AuraCare Medical Center',
      hospital_tagline: 'Excellence in Comprehensive Healthcare & Specialized Medicine',
      logo_url: null,
      favicon_url: '/favicon.ico',
      footer_copyright: '© 2026 AuraCare Medical Center & Super Specialty Institute. All rights reserved.',
      phone: '+1 (800) 555-CARE',
      email: 'concierge@auracare.org',
      address: '742 Evergreen Healthcare Pavilion, Medical District, NY 10001',
      emergency_number: '+1 (800) 911-AURA',
      opening_hours: 'Mon - Sat: 08:00 AM - 08:00 PM | Emergency 24/7',
      currency_code: 'USD',
      currency_symbol: '$',
      timezone: 'America/New_York'
    };
    this.applyToDOM(this._cache);
    return this._cache;
  },

  async reload() {
    this._cache = null;
    return await this.load(true);
  },

  get(key, defaultValue = '') {
    if (!this._cache) return defaultValue;
    return this._cache[key] !== undefined && this._cache[key] !== null ? this._cache[key] : defaultValue;
  },

  formatCurrency(amount) {
    const symbol = this.get('currency_symbol', '$');
    const num = parseFloat(amount) || 0;
    return `${symbol}${num.toFixed(2)}`;
  },

  applyToDOM(s) {
    if (!s) return;

    const hospitalName = s.hospital_name || 'AuraCare Medical Center';

    // 1. Hospital Brand Name in Navbars & Sidebars
    document.querySelectorAll('.brand-logo-grid, .sidebar-brand, .nav-brand, .brand-logo').forEach(brandContainer => {
      const nameSpan = brandContainer.querySelector('.brand-name') || brandContainer.querySelector('span:first-of-type');
      if (nameSpan) {
        nameSpan.textContent = hospitalName;
      }
      const iconBox = brandContainer.querySelector('.brand-icon-box');
      if (iconBox) {
        if (s.logo_url) {
          iconBox.innerHTML = `<img src="${s.logo_url}" alt="${hospitalName} Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: var(--radius-md);">`;
          iconBox.style.background = 'transparent';
          iconBox.style.boxShadow = 'none';
        } else {
          iconBox.innerHTML = `<i class="fa-solid fa-hospital"></i>`;
          iconBox.style.background = '';
          iconBox.style.boxShadow = '';
        }
      }
    });

    document.querySelectorAll('[data-hospital-name]').forEach(el => {
      el.textContent = hospitalName;
    });

    // 2. Favicon Update in <head>
    if (s.favicon_url) {
      let faviconLink = document.querySelector("link[rel*='icon']");
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(faviconLink);
      }
      faviconLink.href = s.favicon_url;
    }

    // 3. Dynamic Browser Title Update
    if (document.title && hospitalName) {
      if (document.title.includes('AuraCare')) {
        document.title = document.title.replace(/AuraCare/g, hospitalName);
      }
    }

    // 4. Hospital Tagline
    document.querySelectorAll('[data-hospital-tagline]').forEach(el => {
      el.textContent = s.hospital_tagline || '';
    });

    // 5. Phone Numbers
    document.querySelectorAll('[data-hospital-phone]').forEach(el => {
      el.textContent = s.phone || '+1 (800) 555-CARE';
      if (el.tagName === 'A') el.href = `tel:${(s.phone || '').replace(/[^0-9+]/g, '')}`;
    });

    // 6. Emergency Hotline
    document.querySelectorAll('[data-hospital-emergency]').forEach(el => {
      el.textContent = s.emergency_number || '+1 (800) 911-AURA';
      if (el.tagName === 'A') el.href = `tel:${(s.emergency_number || '').replace(/[^0-9+]/g, '')}`;
    });

    // 7. Email
    document.querySelectorAll('[data-hospital-email]').forEach(el => {
      el.textContent = s.email || 'concierge@auracare.org';
      if (el.tagName === 'A') el.href = `mailto:${s.email}`;
    });

    // 8. Address
    document.querySelectorAll('[data-hospital-address]').forEach(el => {
      el.textContent = s.address || '742 Evergreen Healthcare Pavilion, Medical District, NY';
    });

    // 9. Opening Hours
    document.querySelectorAll('[data-hospital-hours]').forEach(el => {
      el.textContent = s.opening_hours || 'Mon - Sat: 08:00 AM - 08:00 PM | Emergency 24/7';
    });

    // 10. Footer Copyright
    document.querySelectorAll('[data-footer-copyright], .footer-copyright').forEach(el => {
      el.textContent = s.footer_copyright || `© ${new Date().getFullYear()} ${hospitalName}. All rights reserved.`;
    });

    // 11. Currency Symbol
    document.querySelectorAll('[data-currency-symbol]').forEach(el => {
      el.textContent = s.currency_symbol || '$';
    });
  }
};

// Auto-initialize on DOM ready if API script is loaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof API !== 'undefined') {
      HospitalSettings.load();
    }
  });
}
