/**
 * Main Application Orchestrator & Router
 */

import { api } from './api.js';
import { Toast } from './components.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCatalogue } from './views/catalogue.js';
import { renderInventory } from './views/inventory.js';
import { renderCirculation } from './views/circulation.js';
import { renderStudents } from './views/students.js';

const routes = {
  dashboard: {
    title: 'Dashboard & Reports',
    desc: 'Live operational summary, health status, and overdue loan monitoring.',
    render: renderDashboard,
  },
  catalogue: {
    title: 'Catalogue & Search',
    desc: 'Book inventory, author attribution, publishing houses, and multi-filter discovery.',
    render: renderCatalogue,
  },
  inventory: {
    title: 'Branch & Stock Management',
    desc: 'Branch facilities, multi-location stock matrices, and copy adjustments.',
    render: renderInventory,
  },
  circulation: {
    title: 'Circulation Desk',
    desc: 'Active book issues, checkouts, and 4-key loan returns.',
    render: renderCirculation,
  },
  students: {
    title: 'Student Directory',
    desc: 'Registered library patrons, membership records, and contact details.',
    render: renderStudents,
  },
};

let currentRoute = 'dashboard';

export async function navigate(routeKey) {
  if (!routes[routeKey]) routeKey = 'dashboard';
  currentRoute = routeKey;

  // Update URL hash
  window.location.hash = `#${routeKey}`;

  // Update navigation items active state
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.dataset.route === routeKey) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update Top Bar Header
  const titleEl = document.getElementById('header-title');
  const descEl = document.getElementById('header-description');
  if (titleEl) titleEl.textContent = routes[routeKey].title;
  if (descEl) descEl.textContent = routes[routeKey].desc;

  // Render view
  const viewContainer = document.getElementById('view-container');
  if (viewContainer) {
    viewContainer.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--text-muted);">
        <p>Loading view data...</p>
      </div>
    `;
    try {
      await routes[routeKey].render(viewContainer);
    } catch (err) {
      console.error(`Error rendering route ${routeKey}:`, err);
      viewContainer.innerHTML = `
        <div class="card" style="border-color: var(--color-danger); background-color: var(--color-danger-bg); color: var(--color-danger);">
          <h3>View Render Error</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  }
}

// Health status poller
async function pollHealth() {
  const dot = document.getElementById('health-dot');
  const text = document.getElementById('health-text');
  try {
    const res = await api.getHealth();
    if (res && res.status === 'ok') {
      if (dot) {
        dot.className = 'health-dot online';
      }
      if (text) {
        text.textContent = 'API Server Online';
      }
    } else {
      throw new Error('Unexpected health status');
    }
  } catch (err) {
    if (dot) {
      dot.className = 'health-dot offline';
    }
    if (text) {
      text.textContent = 'API Disconnected';
    }
  }
}

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  // Bind navigation clicks
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const route = el.dataset.route;
      navigate(route);
    });
  });

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && routes[hash] && hash !== currentRoute) {
      navigate(hash);
    }
  });

  // Initial Route
  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  navigate(initialHash);

  // Start Health Poller
  pollHealth();
  setInterval(pollHealth, 10000);
});
