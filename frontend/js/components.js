/**
 * UI Components & Helpers
 * ThreeUI Modular Patterns for Modals, Toasts, Confirm Dialogs, and Table Rendering
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class Toast {
  static container = null;

  static init() {
    if (!this.container) {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        document.body.appendChild(el);
      }
      this.container = el;
    }
  }

  static show(message, type = 'info', duration = 4000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
      ? '✓' 
      : type === 'error' 
      ? '⚠' 
      : 'ℹ';
      
    toast.innerHTML = `
      <span style="font-weight: 800; font-size: 16px;">${icon}</span>
      <div style="flex: 1; word-break: break-word;">${escapeHtml(message)}</div>
      <button style="background:none;border:none;color:inherit;cursor:pointer;font-size:16px;" onclick="this.parentElement.remove()">×</button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  static success(msg) {
    this.show(msg, 'success');
  }

  static error(msg) {
    this.show(msg, 'error', 6000);
  }

  static info(msg) {
    this.show(msg, 'info');
  }
}

export class Modal {
  static modalEl = null;

  static init() {
    if (!this.modalEl) {
      let el = document.getElementById('global-modal');
      if (!el) {
        el = document.createElement('div');
        el.id = 'global-modal';
        el.className = 'modal-overlay';
        el.innerHTML = `
          <div class="modal-content" role="dialog" aria-modal="true">
            <div class="modal-header">
              <h3 class="modal-title" id="modal-title">Modal Title</h3>
              <button class="modal-close" id="modal-close-btn" aria-label="Close modal">&times;</button>
            </div>
            <div class="modal-body" id="modal-body"></div>
            <div class="modal-footer" id="modal-footer"></div>
          </div>
        `;
        document.body.appendChild(el);
      }
      this.modalEl = el;

      // Close handlers
      const closeBtn = el.querySelector('#modal-close-btn');
      closeBtn.onclick = () => this.close();
      el.onclick = (e) => {
        if (e.target === el) this.close();
      };
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.classList.contains('open')) {
          this.close();
        }
      });
    }
  }

  static open({ title, bodyHtml, footerButtons = [], onRender = null }) {
    this.init();
    const titleEl = this.modalEl.querySelector('#modal-title');
    const bodyEl = this.modalEl.querySelector('#modal-body');
    const footerEl = this.modalEl.querySelector('#modal-footer');

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    footerEl.innerHTML = '';

    footerButtons.forEach(btn => {
      const b = document.createElement('button');
      b.className = `btn ${btn.className || 'btn-secondary'}`;
      b.id = btn.id || '';
      b.textContent = btn.label;
      b.onclick = async () => {
        if (btn.onClick) {
          const shouldClose = await btn.onClick();
          if (shouldClose !== false) {
            Modal.close();
          }
        } else {
          Modal.close();
        }
      };
      footerEl.appendChild(b);
    });

    this.modalEl.classList.add('open');
    if (onRender) {
      onRender(bodyEl);
    }
  }

  static close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  static confirm({ title = 'Confirm Action', message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
    this.open({
      title,
      bodyHtml: `<p style="font-size: 14px; color: var(--text-primary);">${escapeHtml(message)}</p>`,
      footerButtons: [
        { label: 'Cancel', className: 'btn-outline', onClick: () => true },
        {
          label: confirmText,
          className: confirmClass,
          id: 'btn-confirm-action',
          onClick: async () => {
            await onConfirm();
            return true;
          },
        },
      ],
    });
  }
}
