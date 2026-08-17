/**
 * AuraCare Medical Center - Accessible Modal Manager
 */
const Modal = (() => {
  let activeModal = null;

  function open(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
      console.warn(`[MODAL] Modal with ID "${modalId}" not found.`);
      return;
    }

    modalEl.classList.add('is-active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    activeModal = modalEl;

    // Focus first input if any
    const firstInput = modalEl.querySelector('input:not([type=hidden]), select, textarea, button:not(.modal-close)');
    if (firstInput) firstInput.focus();
  }

  function close(modalId = null) {
    const modalEl = modalId ? document.getElementById(modalId) : activeModal;
    if (!modalEl) return;

    modalEl.classList.remove('is-active');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (activeModal === modalEl) activeModal = null;
  }

  // Global listeners for dismiss
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) {
      close();
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      close();
    }
    if (e.target.closest('[data-modal-close]')) {
      close();
    }
    const trigger = e.target.closest('[data-modal-target]');
    if (trigger) {
      const targetId = trigger.getAttribute('data-modal-target');
      open(targetId);
    }
  });

  return {
    open,
    close
  };
})();

window.Modal = Modal;
