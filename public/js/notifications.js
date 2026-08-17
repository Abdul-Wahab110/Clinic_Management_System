/**
 * AuraCare Notification Management & Real-Time Bell Dropdown Client Widget
 */
const NotificationWidget = {
  unreadCount: 0,
  pollInterval: null,

  init() {
    this.renderBellWidget();
    this.fetchUnreadCount();
    // Poll unread count every 30s asynchronously without full page reload
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => this.fetchUnreadCount(), 30000);
    }
  },

  renderBellWidget() {
    const topbars = document.querySelectorAll('.dashboard-topbar-grid');
    topbars.forEach(topbar => {
      // Find right section or append
      const rightSection = topbar.querySelector('div:last-child');
      if (rightSection && !topbar.querySelector('.notif-widget-container')) {
        const widget = document.createElement('div');
        widget.className = 'notif-widget-container';
        widget.style.position = 'relative';
        widget.style.display = 'inline-block';
        widget.innerHTML = `
          <button id="notif-bell-btn" class="btn btn-outline btn-sm" style="position: relative; padding: 6px 12px; border-radius: 50px; background: white;" onclick="NotificationWidget.toggleDropdown(event)">
            <i class="fa-solid fa-bell" style="color: var(--color-slate-600); font-size: 0.95rem;"></i>
            <span id="notif-badge" class="badge badge-danger" style="display: none; position: absolute; top: -6px; right: -6px; padding: 2px 6px; font-size: 0.65rem; border-radius: 10px; font-weight: 800; border: 2px solid white;">0</span>
          </button>
          <div id="notif-dropdown-panel" class="card shadow-lg" style="display: none; position: absolute; right: 0; top: calc(100% + 10px); width: 340px; z-index: 1000; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--color-slate-200);">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--color-slate-50); border-bottom: 1px solid var(--color-slate-200);">
              <span style="font-weight: 700; font-size: 0.85rem; color: var(--color-navy);"><i class="fa-solid fa-bell text-primary"></i> Notifications</span>
              <button class="btn btn-link btn-xs" style="font-size: 0.75rem; text-decoration: none; padding: 0;" onclick="NotificationWidget.markAllRead(event)">Mark all read</button>
            </div>
            <div id="notif-dropdown-list" style="max-height: 320px; overflow-y: auto; padding: 0;">
              <div style="padding: 20px; text-align: center; color: var(--color-slate-400); font-size: 0.8rem;">Loading notifications...</div>
            </div>
            <div style="padding: 8px 14px; background: var(--color-slate-50); border-top: 1px solid var(--color-slate-200); text-align: center;">
              <a href="/admin/notifications" style="font-size: 0.75rem; font-weight: 700; color: var(--color-primary); text-decoration: none;">View All Notifications &rarr;</a>
            </div>
          </div>
        `;
        rightSection.insertBefore(widget, rightSection.firstChild);
      }
    });

    // Close dropdown on clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('notif-dropdown-panel');
      const btn = document.getElementById('notif-bell-btn');
      if (panel && btn && !btn.contains(e.target) && !panel.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  },

  async fetchUnreadCount() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await API.get('/notifications/unread-count');
      if (res.success && res.data) {
        this.unreadCount = res.data.unread_count || 0;
        this.updateBadge();
      }
    } catch (_) {}
  },

  updateBadge() {
    const badges = document.querySelectorAll('#notif-badge');
    badges.forEach(b => {
      if (this.unreadCount > 0) {
        b.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        b.style.display = 'inline-block';
      } else {
        b.style.display = 'none';
      }
    });
  },

  async toggleDropdown(e) {
    e.stopPropagation();
    const panel = document.getElementById('notif-dropdown-panel');
    if (!panel) return;
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      await this.loadDropdownList();
    }
  },

  async loadDropdownList() {
    const list = document.getElementById('notif-dropdown-list');
    if (!list) return;
    try {
      const res = await API.get('/notifications', { limit: 5 });
      if (res.success && res.data) {
        const notifs = res.data;
        if (notifs.length === 0) {
          list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--color-slate-400); font-size: 0.8rem;"><i class="fa-regular fa-bell-slash" style="font-size: 1.5rem; margin-bottom: 6px; display: block;"></i>No notifications found.</div>`;
          return;
        }

        list.innerHTML = '';
        notifs.forEach(n => {
          const item = document.createElement('div');
          item.style.padding = '10px 14px';
          item.style.borderBottom = '1px solid var(--color-slate-100)';
          item.style.background = n.is_read ? 'white' : '#f0fdf4';
          item.style.display = 'flex';
          item.style.gap = '10px';
          item.style.alignItems = 'flex-start';
          item.style.cursor = 'pointer';

          const iconConfig = this.getIcon(n.notification_type);

          item.innerHTML = `
            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${iconConfig.bg}; color: ${iconConfig.color}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; margin-top: 2px;">
              <i class="${iconConfig.icon}"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; font-size: 0.8rem; color: var(--color-slate-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.title}</div>
              <div style="font-size: 0.72rem; color: var(--color-slate-500); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3;">${n.message}</div>
              <div style="font-size: 0.65rem; color: var(--color-slate-400); margin-top: 4px;">${this.formatTime(n.created_at)}</div>
            </div>
          `;

          item.onclick = async () => {
            if (!n.is_read) {
              await API.patch(`/notifications/${n.id}/read`);
              this.unreadCount = Math.max(0, this.unreadCount - 1);
              this.updateBadge();
            }
            if (n.action_url) {
              window.location.href = n.action_url;
            }
          };

          list.appendChild(item);
        });
      }
    } catch (err) {
      list.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--color-danger); font-size: 0.75rem;">Failed to load: ${err.message}</div>`;
    }
  },

  async markAllRead(e) {
    e.stopPropagation();
    try {
      await API.patch('/notifications/mark-all-read');
      this.unreadCount = 0;
      this.updateBadge();
      await this.loadDropdownList();
      if (typeof Toast !== 'undefined') Toast.success('All notifications marked as read.');
    } catch (_) {}
  },

  getIcon(type) {
    switch (type) {
      case 'appointment_confirmation':
      case 'appointment_reminder':
        return { icon: 'fa-solid fa-calendar-check', bg: '#e0f2fe', color: '#0284c7' };
      case 'appointment_cancellation':
        return { icon: 'fa-solid fa-calendar-xmark', bg: '#fee2e2', color: '#dc2626' };
      case 'lab_report_ready':
        return { icon: 'fa-solid fa-vial-circle-check', bg: '#ccfbf1', color: '#0d9488' };
      case 'prescription_created':
        return { icon: 'fa-solid fa-prescription', bg: '#f3e8ff', color: '#9333ea' };
      case 'payment_received':
        return { icon: 'fa-solid fa-receipt', bg: '#dcfce7', color: '#16a34a' };
      case 'low_stock':
        return { icon: 'fa-solid fa-triangle-exclamation', bg: '#fef3c7', color: '#d97706' };
      case 'system_notification':
      default:
        return { icon: 'fa-solid fa-bell', bg: '#f1f5f9', color: '#475569' };
    }
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  NotificationWidget.init();
});
