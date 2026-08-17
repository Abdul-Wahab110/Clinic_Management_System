/**
 * AuraCare Hospital - Unified Responsive Layout & Navigation Controller
 * Handles Desktop, Laptop, Tablet, and Mobile viewport interactions.
 */

(function () {
  function init() {
    initPublicMobileNav();
    initDashboardMobileSidebar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * 1. Public Site Header & Mobile Navigation Drawer
   */
  function initPublicMobileNav() {
    const toggleBtn = document.getElementById('mobile-nav-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    const icon = document.getElementById('mobile-nav-icon');

    if (!toggleBtn || !drawer) return;
    if (toggleBtn.dataset.navBound === 'true') return;
    toggleBtn.dataset.navBound = 'true';

    // Ensure dedicated public mobile backdrop exists
    let backdrop = document.querySelector('.mobile-nav-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'mobile-nav-backdrop';
      document.body.appendChild(backdrop);
    }

    function setDrawerState(isOpen) {
      if (isOpen) {
        drawer.classList.add('is-open');
        backdrop.classList.add('is-active');
        toggleBtn.setAttribute('aria-expanded', 'true');
        if (icon) {
          icon.className = 'fa-solid fa-xmark';
        }
        document.body.style.overflow = 'hidden';
      } else {
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-active');
        toggleBtn.setAttribute('aria-expanded', 'false');
        if (icon) {
          icon.className = 'fa-solid fa-bars';
        }
        document.body.style.overflow = '';
      }
    }

    function toggleDrawer(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isOpen = drawer.classList.contains('is-open');
      setDrawerState(!isOpen);
    }

    // Toggle button click & touch
    toggleBtn.addEventListener('click', toggleDrawer);

    // Global toggle helper
    window.toggleMobileNav = toggleDrawer;

    // Backdrop click closes drawer
    backdrop.addEventListener('click', () => {
      setDrawerState(false);
    });

    // Event Delegation: Close drawer when clicking ANY link or button inside drawer (including dynamic auth buttons)
    drawer.addEventListener('click', (e) => {
      const target = e.target.closest('a, button');
      if (target) {
        // If clicking a modal trigger button, let modal open smoothly
        setDrawerState(false);
      }
    });

    // Close drawer on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        setDrawerState(false);
      }
    });

    // Reset drawer if screen is resized back to desktop (> 1180px)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1180 && drawer.classList.contains('is-open')) {
        setDrawerState(false);
      }
    });
  }

  /**
   * 2. Dashboard Off-Canvas Sidebar for Tablets & Mobile Devices
   */
  function initDashboardMobileSidebar() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    const topbar = document.querySelector('.dashboard-topbar-grid, .dashboard-topbar, .dashboard-header, header');

    if (!sidebar) return;

    // Auto-highlight active navigation item matching current URL
    const currentPath = (window.location.pathname || '').toLowerCase().replace(/\/$/, '') || '/';
    sidebar.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const linkPath = href.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '') || '/';
      if (linkPath === currentPath || (currentPath.endsWith(linkPath) && linkPath !== '/' && linkPath.length > 2)) {
        link.classList.add('active');
        link.classList.remove('btn-outline');
      }
    });

    // Inject mobile close button into sidebar header if not present
    let closeBtn = sidebar.querySelector('.sidebar-close-btn');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'sidebar-close-btn';
      closeBtn.setAttribute('aria-label', 'Close Sidebar Navigation');
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      sidebar.prepend(closeBtn);
    }

    if (topbar) {
      // Check if toggle button already exists
      let toggleBtn = topbar.querySelector('.sidebar-toggle-btn');
      if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'sidebar-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle Sidebar Navigation');
        toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        
        // Prepend toggle button to the topbar's first child flex container
        const firstGroup = topbar.firstElementChild;
        if (firstGroup) {
          firstGroup.insertBefore(toggleBtn, firstGroup.firstChild);
        } else {
          topbar.prepend(toggleBtn);
        }
      }

      if (toggleBtn.dataset.sidebarBound !== 'true') {
        toggleBtn.dataset.sidebarBound = 'true';
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSidebar();
        });
      }

      // Inject top left header logout button across all portals if not present
      let headerLogoutBtn = topbar.querySelector('.header-topbar-logout-btn, [data-header-logout]');
      if (!headerLogoutBtn) {
        headerLogoutBtn = document.createElement('button');
        headerLogoutBtn.type = 'button';
        headerLogoutBtn.className = 'btn btn-sm btn-outline-danger header-topbar-logout-btn';
        headerLogoutBtn.setAttribute('data-action-logout', 'true');
        headerLogoutBtn.setAttribute('data-header-logout', 'true');
        headerLogoutBtn.setAttribute('title', 'Sign Out of Portal');
        headerLogoutBtn.style.cssText = 'display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 600; padding: 0.35rem 0.65rem; border-radius: var(--radius-md, 6px); border: 1px solid rgba(239, 68, 68, 0.35); color: #ef4444; background: rgba(239, 68, 68, 0.08); cursor: pointer; transition: all 0.2s; margin-left: 0.75rem;';
        headerLogoutBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Sign Out</span>';

        const firstGroup = topbar.firstElementChild;
        if (firstGroup) {
          firstGroup.appendChild(headerLogoutBtn);
        } else {
          topbar.prepend(headerLogoutBtn);
        }
      }
    }

    // Create backdrop overlay element if not present
    let backdrop = document.querySelector('.dashboard-sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'dashboard-sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    // Toggle sidebar function
    function toggleSidebar(open) {
      const shouldOpen = open !== undefined ? open : !sidebar.classList.contains('mobile-open');
      if (shouldOpen) {
        sidebar.classList.add('mobile-open');
        backdrop.classList.add('is-active');
        document.body.style.overflow = 'hidden';
      } else {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('is-active');
        document.body.style.overflow = '';
      }
    }

    // Bind close button
    if (closeBtn && closeBtn.dataset.bound !== 'true') {
      closeBtn.dataset.bound = 'true';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar(false);
      });
    }

    // Backdrop click closes sidebar
    backdrop.addEventListener('click', () => {
      toggleSidebar(false);
    });

    // Auto close sidebar when clicking navigation links on mobile
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          toggleSidebar(false);
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
        toggleSidebar(false);
      }
    });

    // Auto-reset if screen is resized back to desktop (> 1024px)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024 && sidebar.classList.contains('mobile-open')) {
        toggleSidebar(false);
      }
    });
  }
})();
