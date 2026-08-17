/**
 * AuraCare Medical Center - Toast Notification System
 */
const Toast = (() => {
  let container = null;

  function ensureContainer() {
    if (!container) {
      container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function show(message, type = 'info', durationMs = 4000) {
    const parent = ensureContainer();
    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;

    let iconSymbol = 'ℹ️';
    if (type === 'success') iconSymbol = '✅';
    if (type === 'error') iconSymbol = '⚠️';
    if (type === 'warning') iconSymbol = '⚡';

    item.innerHTML = `
      <span class="toast-icon">${iconSymbol}</span>
      <div class="toast-message">${escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = item.querySelector('.toast-close');
    const dismiss = () => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(-8px)';
      setTimeout(() => item.remove(), 250);
    };

    closeBtn.addEventListener('click', dismiss);

    parent.appendChild(item);

    if (durationMs > 0) {
      setTimeout(dismiss, durationMs);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    success: (msg, duration) => show(msg, 'success', duration),
    error: (msg, duration) => show(msg, 'error', duration || 5000),
    warning: (msg, duration) => show(msg, 'warning', duration),
    info: (msg, duration) => show(msg, 'info', duration)
  };
})();

window.Toast = Toast;
