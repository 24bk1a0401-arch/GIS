/**
 * GeoSafe GIS - Dedicated Admin Dashboard Application
 * Handles authentication checks, RBAC restrictions, Chart.js visualizations,
 * and CRUD operations across all 9 Administrative Modules (A - I).
 */

(function () {
  'use strict';

  // Global Admin State
  const state = {
    currentUser: null,
    currentModule: 'dashboard',
    analytics: null,
    services: [],
    servicesPage: 1,
    servicesTotalPages: 1,
    riskZones: [],
    incidents: [],
    incidentsPage: 1,
    incidentsTotalPages: 1,
    users: [],
    auditLogs: [],
    auditPage: 1,
    settings: {},
    categories: [],
    charts: {}
  };

  // Toast Helper
  function showToast(message, type = 'info') {
    const hub = document.getElementById('adminToastHub');
    if (!hub) return;
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type === 'error' ? 'err' : type === 'success' ? 'ok' : ''}`;
    toast.textContent = message;
    hub.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // Session Authentication Check
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (!json.success || !json.user) {
        window.location.href = '/admin/login';
        return;
      }
      state.currentUser = json.user;
      renderUserProfile();
    } catch (err) {
      window.location.href = '/admin/login';
    }
  }

  function renderUserProfile() {
    const nameEl = document.getElementById('adminUserName');
    const roleEl = document.getElementById('adminUserRole');
    const avatarEl = document.getElementById('adminUserAvatar');

    if (nameEl) nameEl.textContent = state.currentUser.full_name || state.currentUser.username;
    if (roleEl) roleEl.textContent = state.currentUser.role;
    if (avatarEl) avatarEl.textContent = (state.currentUser.username || 'A').charAt(0).toUpperCase();

    // Restrict User Management and Settings for non-Admins
    if (state.currentUser.role === 'Read-Only Viewer') {
      document.querySelectorAll('.btn-add-action, .btn-destructive').forEach(el => el.style.display = 'none');
    }
  }

  // Module Router & Switcher
  function switchModule(moduleKey) {
    state.currentModule = moduleKey;

    // Update sidebar navigation active item
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.module === moduleKey);
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('currentModuleBreadcrumb');
    if (breadcrumb) {
      const moduleNames = {
        dashboard: 'Dashboard Overview',
        services: 'Essential Service Management',
        riskzones: 'Risk-Zone Authoring & Polygons',
        incidents: 'Citizen Incident Moderation',
        users: 'User & Role Access Management',
        layers: 'Map & Layer Settings',
        analytics: 'Reports & Analytics',
        audit: 'Security Audit Trail',
        settings: 'System Configuration'
      };
      breadcrumb.textContent = moduleNames[moduleKey] || moduleKey;
    }

    // Hide all modules, show selected
    document.querySelectorAll('.admin-module-view').forEach(view => {
      view.style.display = 'none';
    });
    const targetView = document.getElementById(`module_${moduleKey}`);
    if (targetView) targetView.style.display = 'block';

    // Load data for module
    if (moduleKey === 'dashboard') loadDashboardModule();
    else if (moduleKey === 'services') loadServicesModule();
    else if (moduleKey === 'riskzones') loadRiskZonesModule();
    else if (moduleKey === 'incidents') loadIncidentsModule();
    else if (moduleKey === 'users') loadUsersModule();
    else if (moduleKey === 'layers') loadMapSettingsModule();
    else if (moduleKey === 'analytics') loadAnalyticsModule();
    else if (moduleKey === 'audit') loadAuditModule();
    else if (moduleKey === 'settings') loadSettingsModule();
  }

  // =========================================================================
  // MODULE A: DASHBOARD OVERVIEW
  // =========================================================================
  async function loadDashboardModule() {
    try {
      const res = await fetch('/api/admin/analytics');
      const json = await res.json();
      if (!json.success) return;

      state.analytics = json.data;

      // Summary Metric Cards
      document.getElementById('mTotalServices').textContent = json.data.services.total;
      document.getElementById('mVerifiedServices').textContent = `${json.data.services.verified} Verified`;
      document.getElementById('mActiveIncidents').textContent = json.data.incidents.active;
      document.getElementById('mTotalIncidents').textContent = `${json.data.incidents.total} Total Logged`;
      document.getElementById('mRiskZones').textContent = json.data.riskZones.published;
      document.getElementById('mRiskDrafts').textContent = `${json.data.riskZones.draft} Drafts`;
      document.getElementById('mDataFreshness').textContent = new Date(json.data.systemFreshness).toLocaleTimeString();

      // Render Charts
      renderDashboardCharts(json.data);

      // Render Recent Activities Stream
      const streamContainer = document.getElementById('recentActivityStream');
      if (streamContainer) {
        let streamHtml = '';
        json.data.recentActivities.forEach(act => {
          streamHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(120,200,255,0.08); font-size:0.84rem;">
              <div>
                <span class="badge" style="background:rgba(34,211,238,0.1); color:#22d3ee; margin-right:8px;">${act.action}</span>
                <span style="color:#f1f5f9;">${act.details}</span>
              </div>
              <div style="font-size:0.75rem; color:#64748b; font-family:var(--font-mono);">${new Date(act.created_at).toLocaleTimeString()}</div>
            </div>
          `;
        });
        streamContainer.innerHTML = streamHtml || '<p style="color:#64748b; font-size:0.85rem;">No recent activities logged.</p>';
      }
    } catch (err) {
      console.error('[ADMIN] Dashboard error:', err);
    }
  }

  function renderDashboardCharts(data) {
    // 1. Service Categories Doughnut Chart
    const ctxCat = document.getElementById('chartCategories');
    if (ctxCat && window.Chart) {
      if (state.charts.categories) state.charts.categories.destroy();

      const labels = data.services.byCategory.map(c => c.name);
      const counts = data.services.byCategory.map(c => c.count);
      const colors = data.services.byCategory.map(c => c.color || '#2563eb');

      state.charts.categories = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#0d162e'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
          }
        }
      });
    }

    // 2. Incident Status Bar Chart
    const ctxInc = document.getElementById('chartIncidents');
    if (ctxInc && window.Chart) {
      if (state.charts.incidents) state.charts.incidents.destroy();

      const incLabels = data.incidents.byStatus.map(s => s.status);
      const incCounts = data.incidents.byStatus.map(s => s.count);

      state.charts.incidents = new Chart(ctxInc, {
        type: 'bar',
        data: {
          labels: incLabels,
          datasets: [{
            label: 'Incident Reports',
            data: incCounts,
            backgroundColor: ['#f59e0b', '#38bdf8', '#10b981', '#ef4444'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  // =========================================================================
  // MODULE B: ESSENTIAL SERVICE MANAGEMENT (CRUD, CSV)
  // =========================================================================
  async function loadServicesModule() {
    const searchVal = document.getElementById('serviceSearchInput')?.value || '';
    const catVal = document.getElementById('serviceCategoryFilter')?.value || 'all';

    try {
      const res = await fetch(`/api/services?page=${state.servicesPage}&limit=10&search=${encodeURIComponent(searchVal)}&category=${catVal}`);
      const json = await res.json();
      if (!json.success) return;

      state.services = json.data;
      state.servicesTotalPages = json.pagination.totalPages;

      renderServicesTable();
    } catch (err) {
      console.error('[ADMIN] Services table error:', err);
    }
  }

  function renderServicesTable() {
    const tbody = document.getElementById('servicesTableBody');
    if (!tbody) return;

    if (state.services.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">No matching service records found.</td></tr>`;
      return;
    }

    let html = '';
    state.services.forEach(s => {
      const isVerified = s.verification_status === 'Verified';
      const badgeClass = isVerified ? 'badge-verified' : 'badge-unverified';

      html += `
        <tr>
          <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">#${s.id}</td>
          <td>
            <div style="font-weight:700; color:#fff;">${s.name}</div>
            <div style="font-size:0.75rem; color:#64748b;">${s.address}${s.locality ? ', ' + s.locality : ''}</div>
          </td>
          <td><span class="badge" style="background:${s.category_color}20; color:${s.category_color};">${s.category_name || s.category_key}</span></td>
          <td style="font-family:var(--font-mono); font-size:0.78rem;">${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}</td>
          <td>${s.phone || '<span style="color:#64748b;">—</span>'}</td>
          <td><span class="badge ${badgeClass}">${s.verification_status}</span></td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm" onclick="window.adminOpenEditService(${s.id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.adminDeleteService(${s.id}, '${s.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    document.getElementById('servicesPageIndicator').textContent = `Page ${state.servicesPage} of ${state.servicesTotalPages || 1}`;
  }

  // =========================================================================
  // MODULE C: RISK-ZONE MANAGEMENT (POLYGONS & GEOJSON)
  // =========================================================================
  async function loadRiskZonesModule() {
    try {
      const res = await fetch('/api/risk-zones?all=true');
      const json = await res.json();
      if (!json.success) return;

      state.riskZones = json.data;
      renderRiskZonesTable();
    } catch (err) {
      console.error('[ADMIN] Risk zones error:', err);
    }
  }

  function renderRiskZonesTable() {
    const tbody = document.getElementById('riskZonesTableBody');
    if (!tbody) return;

    if (state.riskZones.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">No risk zones defined.</td></tr>`;
      return;
    }

    let html = '';
    state.riskZones.forEach(rz => {
      let badgeClass = 'badge-high';
      if (rz.risk_level === 'Medium') badgeClass = 'badge-medium';
      if (rz.risk_level === 'Low') badgeClass = 'badge-low';

      const isPublished = rz.is_published === 1;

      html += `
        <tr>
          <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">#${rz.id}</td>
          <td>
            <div style="font-weight:700; color:#fff;">${rz.name}</div>
            <div style="font-size:0.75rem; color:#94a3b8; max-width:320px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${rz.description}</div>
          </td>
          <td>${rz.risk_type}</td>
          <td><span class="badge ${badgeClass}">${rz.risk_level} (${rz.score})</span></td>
          <td>${rz.coordinates_geojson ? 'Geographic Polygon' : `${rz.radius_km || 2} km Circle`}</td>
          <td><span class="badge ${isPublished ? 'badge-verified' : 'badge-unverified'}">${isPublished ? 'Published' : 'Draft'}</span></td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm" onclick="window.adminOpenEditRiskZone(${rz.id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.adminDeleteRiskZone(${rz.id}, '${rz.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // =========================================================================
  // MODULE D: INCIDENT MANAGEMENT & MODERATION
  // =========================================================================
  async function loadIncidentsModule() {
    const statusVal = document.getElementById('incidentStatusFilter')?.value || 'all';

    try {
      const res = await fetch(`/api/incidents?page=${state.incidentsPage}&limit=10&status=${statusVal}`);
      const json = await res.json();
      if (!json.success) return;

      state.incidents = json.data;
      state.incidentsTotalPages = json.pagination.totalPages;

      renderIncidentsTable();
    } catch (err) {
      console.error('[ADMIN] Incidents error:', err);
    }
  }

  function renderIncidentsTable() {
    const tbody = document.getElementById('incidentsTableBody');
    if (!tbody) return;

    if (state.incidents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#64748b;">No incident reports matching filters.</td></tr>`;
      return;
    }

    let html = '';
    state.incidents.forEach(inc => {
      let statusBadge = 'badge-pending';
      if (inc.status === 'Verified') statusBadge = 'badge-verified';
      if (inc.status === 'Resolved') statusBadge = 'badge-resolved';
      if (inc.status === 'Rejected') statusBadge = 'badge-high';

      html += `
        <tr>
          <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">${inc.reference_id}</td>
          <td>
            <div style="font-weight:700; color:#fff;">${inc.title}</div>
            <div style="font-size:0.75rem; color:#64748b;">${inc.address || 'Coordinates Recorded'}</div>
          </td>
          <td>${inc.category}</td>
          <td><span class="badge ${statusBadge}">${inc.status}</span></td>
          <td style="font-size:0.78rem;">${inc.reporter_name ? inc.reporter_name + '<br><span style="color:#64748b;">' + inc.reporter_phone + '</span>' : '<span style="color:#64748b;">Anonymous</span>'}</td>
          <td style="font-size:0.75rem; color:#64748b;">${new Date(inc.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="window.adminOpenIncidentReview(${inc.id})">Review &amp; Moderate</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    document.getElementById('incidentsPageIndicator').textContent = `Page ${state.incidentsPage} of ${state.incidentsTotalPages || 1}`;
  }

  // =========================================================================
  // MODULE E: USER MANAGEMENT & RBAC
  // =========================================================================
  async function loadUsersModule() {
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!json.success) {
        document.getElementById('usersTableBody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#ef4444;">${json.error}</td></tr>`;
        return;
      }

      state.users = json.data;
      renderUsersTable();
    } catch (err) {
      console.error('[ADMIN] Users error:', err);
    }
  }

  function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    let html = '';
    state.users.forEach(u => {
      const isActive = u.status === 'active';
      html += `
        <tr>
          <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">#${u.id}</td>
          <td>
            <div style="font-weight:700; color:#fff;">${u.full_name}</div>
            <div style="font-size:0.75rem; color:#64748b;">@${u.username} &bull; ${u.email}</div>
          </td>
          <td><span class="role-badge">${u.role}</span></td>
          <td><span class="badge ${isActive ? 'badge-verified' : 'badge-high'}">${u.status}</span></td>
          <td style="font-size:0.75rem; color:#64748b;">${u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm" onclick="window.adminOpenEditUser(${u.id})">Edit</button>
              ${u.id !== state.currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="window.adminDeleteUser(${u.id}, '${u.username}')">Delete</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  // =========================================================================
  // MODULE F: MAP & LAYER SETTINGS
  // =========================================================================
  async function loadMapSettingsModule() {
    try {
      const res = await fetch('/api/admin/settings');
      const json = await res.json();
      if (!json.success) return;

      json.data.forEach(s => {
        const input = document.getElementById(`setting_${s.setting_key}`);
        if (input) input.value = s.setting_value;
      });
    } catch (err) {
      console.error('[ADMIN] Map settings error:', err);
    }
  }

  // =========================================================================
  // MODULE G: REPORTS & ANALYTICS
  // =========================================================================
  async function loadAnalyticsModule() {
    try {
      const res = await fetch('/api/admin/analytics');
      const json = await res.json();
      if (!json.success) return;

      document.getElementById('repTotalServices').textContent = json.data.services.total;
      document.getElementById('repTotalIncidents').textContent = json.data.incidents.total;
      document.getElementById('repTotalRiskZones').textContent = json.data.riskZones.total;
      document.getElementById('repVerifiedPct').textContent = `${Math.round((json.data.services.verified / (json.data.services.total || 1)) * 100)}%`;
    } catch (err) {
      console.error('[ADMIN] Reports error:', err);
    }
  }

  // =========================================================================
  // MODULE H: AUDIT LOGS
  // =========================================================================
  async function loadAuditModule() {
    try {
      const res = await fetch(`/api/admin/audit-logs?page=${state.auditPage}&limit=15`);
      const json = await res.json();
      if (!json.success) return;

      const tbody = document.getElementById('auditTableBody');
      if (!tbody) return;

      let html = '';
      json.data.forEach(log => {
        html += `
          <tr>
            <td style="font-family:var(--font-mono); font-size:0.75rem; color:#64748b;">${new Date(log.created_at).toLocaleString()}</td>
            <td style="font-weight:700; color:#fff;">${log.username}</td>
            <td><span class="badge" style="background:rgba(34,211,238,0.1); color:#22d3ee;">${log.action}</span></td>
            <td>${log.entity_type} #${log.entity_id || '—'}</td>
            <td style="font-size:0.8rem; color:#cbd5e1;">${log.details}</td>
            <td style="font-family:var(--font-mono); font-size:0.75rem; color:#64748b;">${log.ip_address}</td>
          </tr>
        `;
      });

      tbody.innerHTML = html || `<tr><td colspan="6" style="text-align:center; padding:32px; color:#64748b;">No audit records found.</td></tr>`;
      document.getElementById('auditPageIndicator').textContent = `Page ${json.pagination.page} of ${json.pagination.totalPages || 1}`;
    } catch (err) {
      console.error('[ADMIN] Audit log error:', err);
    }
  }

  // =========================================================================
  // MODULE I: SYSTEM SETTINGS
  // =========================================================================
  async function loadSettingsModule() {
    try {
      const res = await fetch('/api/admin/settings');
      const json = await res.json();
      if (!json.success) return;

      json.data.forEach(s => {
        const input = document.getElementById(`setting_${s.setting_key}`);
        if (input) input.value = s.setting_value;
      });
    } catch (err) {
      console.error('[ADMIN] Settings error:', err);
    }
  }

  // =========================================================================
  // GLOBAL WINDOW ACTIONS (For Modal Buttons & Table Event Triggers)
  // =========================================================================
  window.adminOpenAddService = function () {
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceModalId').value = '';
    document.getElementById('serviceModalTitle').textContent = 'Add New Essential Service Facility';
    document.getElementById('serviceModal').classList.add('open');
  };

  window.adminOpenEditService = function (id) {
    const s = state.services.find(item => item.id === id);
    if (!s) return;

    document.getElementById('serviceModalId').value = s.id;
    document.getElementById('serviceModalTitle').textContent = `Edit Service Facility: #${s.id}`;
    document.getElementById('sName').value = s.name;
    document.getElementById('sCategory').value = s.category_key;
    document.getElementById('sLat').value = s.latitude;
    document.getElementById('sLng').value = s.longitude;
    document.getElementById('sAddress').value = s.address;
    document.getElementById('sLocality').value = s.locality || '';
    document.getElementById('sPhone').value = s.phone || '';
    document.getElementById('sHours').value = s.operating_hours || '';
    document.getElementById('sStatus').value = s.availability_status || 'Available';
    document.getElementById('sVerification').value = s.verification_status || 'Verified';
    document.getElementById('sDesc').value = s.description || '';

    document.getElementById('serviceModal').classList.add('open');
  };

  window.adminDeleteService = async function (id, name) {
    if (!confirm(`Are you sure you want to permanently delete '${name}' (ID #${id})? This action will be audited.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');
        loadServicesModule();
      } else {
        showToast(json.error || 'Delete failed.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting service.', 'error');
    }
  };

  window.adminOpenAddRiskZone = function () {
    document.getElementById('riskZoneForm').reset();
    document.getElementById('riskZoneModalId').value = '';
    document.getElementById('riskZoneModalTitle').textContent = 'Create Geographic Risk Zone';
    document.getElementById('riskZoneModal').classList.add('open');
  };

  window.adminOpenEditRiskZone = function (id) {
    const rz = state.riskZones.find(item => item.id === id);
    if (!rz) return;

    document.getElementById('riskZoneModalId').value = rz.id;
    document.getElementById('riskZoneModalTitle').textContent = `Edit Risk Zone: #${rz.id}`;
    document.getElementById('rzName').value = rz.name;
    document.getElementById('rzType').value = rz.risk_type;
    document.getElementById('rzLevel').value = rz.risk_level;
    document.getElementById('rzScore').value = rz.score;
    document.getElementById('rzLat').value = rz.latitude;
    document.getElementById('rzLng').value = rz.longitude;
    document.getElementById('rzRadius').value = rz.radius_km || 2.0;
    document.getElementById('rzGeoJSON').value = rz.coordinates_geojson ? JSON.stringify(rz.coordinates_geojson, null, 2) : '';
    document.getElementById('rzSource').value = rz.data_source;
    document.getElementById('rzPublished').value = rz.is_published;
    document.getElementById('rzDesc').value = rz.description;

    document.getElementById('riskZoneModal').classList.add('open');
  };

  window.adminDeleteRiskZone = async function (id, name) {
    if (!confirm(`Delete risk zone '${name}'? This will remove the layer from public maps.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/risk-zones/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');
        loadRiskZonesModule();
      }
    } catch (err) {
      showToast('Failed to delete risk zone.', 'error');
    }
  };

  window.adminOpenIncidentReview = function (id) {
    const inc = state.incidents.find(item => item.id === id);
    if (!inc) return;

    document.getElementById('incModalId').value = inc.id;
    document.getElementById('incModalRef').textContent = inc.reference_id;
    document.getElementById('incModalTitle').textContent = inc.title;
    document.getElementById('incModalDesc').textContent = inc.description;
    document.getElementById('incModalCategory').textContent = inc.category;
    document.getElementById('incModalAddress').textContent = inc.address || 'Unspecified';
    document.getElementById('incModalReporter').textContent = `${inc.reporter_name || 'Anonymous'} (${inc.reporter_phone || 'No phone'})`;
    document.getElementById('incStatusSelect').value = inc.status;
    document.getElementById('incPrioritySelect').value = inc.priority;
    document.getElementById('incAssignedInput').value = inc.assigned_to || '';
    document.getElementById('incPublicToggle').value = inc.is_public ? '1' : '0';
    document.getElementById('incNotesInput').value = inc.internal_notes || '';

    const photoContainer = document.getElementById('incPhotoContainer');
    if (inc.photo_url) {
      photoContainer.innerHTML = `<img src="${inc.photo_url}" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #334155; margin-top:10px;" alt="Incident Photo">`;
    } else {
      photoContainer.innerHTML = '<span style="color:#64748b; font-size:0.8rem;">No photo uploaded</span>';
    }

    document.getElementById('incidentReviewModal').classList.add('open');
  };

  window.adminOpenAddUser = function () {
    document.getElementById('userForm').reset();
    document.getElementById('userModalId').value = '';
    document.getElementById('userModalTitle').textContent = 'Add Administrative User';
    document.getElementById('userPasswordGroup').style.display = 'block';
    document.getElementById('userModal').classList.add('open');
  };

  window.adminOpenEditUser = function (id) {
    const u = state.users.find(item => item.id === id);
    if (!u) return;

    document.getElementById('userModalId').value = u.id;
    document.getElementById('userModalTitle').textContent = `Edit User: @${u.username}`;
    document.getElementById('uUsername').value = u.username;
    document.getElementById('uUsername').disabled = true;
    document.getElementById('uFullName').value = u.full_name;
    document.getElementById('uEmail').value = u.email;
    document.getElementById('uRole').value = u.role;
    document.getElementById('uStatus').value = u.status;
    document.getElementById('uPassword').value = '';
    document.getElementById('userPasswordGroup').style.display = 'block';
    document.getElementById('userPasswordHint').textContent = 'Leave blank to preserve current password';

    document.getElementById('userModal').classList.add('open');
  };

  window.adminDeleteUser = async function (id, username) {
    if (!confirm(`Are you sure you want to delete administrator '@${username}'?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');
        loadUsersModule();
      } else {
        showToast(json.error, 'error');
      }
    } catch (err) {
      showToast('Failed to delete user.', 'error');
    }
  };

  window.closeAdminModal = function (modalId) {
    document.getElementById(modalId)?.classList.remove('open');
  };

  // DOM Event Listeners Initialization
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Sidebar navigation clicks
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.addEventListener('click', function () {
        switchModule(this.dataset.module);
      });
    });

    // Sidebar collapse toggle
    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        document.querySelector('aside.admin-sidebar').classList.toggle('collapsed');
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
          localStorage.removeItem('geosafe_user');
          localStorage.removeItem('geosafe_token');
          window.location.href = '/admin/login';
        } catch (e) {
          window.location.href = '/admin/login';
        }
      });
    }

    // Service Form Submit (Add/Edit)
    const serviceForm = document.getElementById('serviceForm');
    if (serviceForm) {
      serviceForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('serviceModalId').value;
        const payload = {
          name: document.getElementById('sName').value,
          category_key: document.getElementById('sCategory').value,
          latitude: document.getElementById('sLat').value,
          longitude: document.getElementById('sLng').value,
          address: document.getElementById('sAddress').value,
          locality: document.getElementById('sLocality').value,
          phone: document.getElementById('sPhone').value,
          operating_hours: document.getElementById('sHours').value,
          availability_status: document.getElementById('sStatus').value,
          verification_status: document.getElementById('sVerification').value,
          description: document.getElementById('sDesc').value
        };

        const url = id ? `/api/services/${id}` : '/api/services';
        const method = id ? 'PUT' : 'POST';

        try {
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message, 'success');
            window.closeAdminModal('serviceModal');
            loadServicesModule();
          } else {
            showToast(json.error || 'Operation failed.', 'error');
          }
        } catch (err) {
          showToast('Network error saving service.', 'error');
        }
      });
    }

    // Risk Zone Form Submit (Add/Edit)
    const rzForm = document.getElementById('riskZoneForm');
    if (rzForm) {
      rzForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('riskZoneModalId').value;
        let geojsonVal = null;
        const rawGeo = document.getElementById('rzGeoJSON').value.trim();
        if (rawGeo) {
          try {
            geojsonVal = JSON.parse(rawGeo);
          } catch (e) {
            showToast('Invalid GeoJSON syntax.', 'error');
            return;
          }
        }

        const payload = {
          name: document.getElementById('rzName').value,
          risk_type: document.getElementById('rzType').value,
          risk_level: document.getElementById('rzLevel').value,
          score: document.getElementById('rzScore').value,
          latitude: document.getElementById('rzLat').value,
          longitude: document.getElementById('rzLng').value,
          radius_km: document.getElementById('rzRadius').value,
          coordinates_geojson: geojsonVal,
          data_source: document.getElementById('rzSource').value,
          is_published: document.getElementById('rzPublished').value === '1',
          description: document.getElementById('rzDesc').value
        };

        const url = id ? `/api/risk-zones/${id}` : '/api/risk-zones';
        const method = id ? 'PUT' : 'POST';

        try {
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message, 'success');
            window.closeAdminModal('riskZoneModal');
            loadRiskZonesModule();
          } else {
            showToast(json.error || 'Failed to save risk zone.', 'error');
          }
        } catch (err) {
          showToast('Network error.', 'error');
        }
      });
    }

    // Incident Status Update Form Submit
    const incForm = document.getElementById('incidentReviewForm');
    if (incForm) {
      incForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('incModalId').value;
        const payload = {
          status: document.getElementById('incStatusSelect').value,
          priority: document.getElementById('incPrioritySelect').value,
          assigned_to: document.getElementById('incAssignedInput').value,
          is_public: document.getElementById('incPublicToggle').value === '1',
          internal_notes: document.getElementById('incNotesInput').value
        };

        try {
          const res = await fetch(`/api/incidents/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message, 'success');
            window.closeAdminModal('incidentReviewModal');
            loadIncidentsModule();
          } else {
            showToast(json.error, 'error');
          }
        } catch (err) {
          showToast('Failed to update incident status.', 'error');
        }
      });
    }

    // User Form Submit (Add/Edit)
    const userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = document.getElementById('userModalId').value;
        const payload = {
          username: document.getElementById('uUsername').value,
          full_name: document.getElementById('uFullName').value,
          email: document.getElementById('uEmail').value,
          role: document.getElementById('uRole').value,
          status: document.getElementById('uStatus').value,
          password: document.getElementById('uPassword').value
        };

        const url = id ? `/api/admin/users/${id}` : '/api/admin/users';
        const method = id ? 'PUT' : 'POST';

        try {
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message, 'success');
            window.closeAdminModal('userModal');
            loadUsersModule();
          } else {
            showToast(json.error || 'Failed to save user.', 'error');
          }
        } catch (err) {
          showToast('Network error saving user.', 'error');
        }
      });
    }

    // CSV Import Form
    const csvForm = document.getElementById('csvImportForm');
    if (csvForm) {
      csvForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const csvData = document.getElementById('csvTextInput').value;

        try {
          const res = await fetch('/api/services/import-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvData })
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message, 'success');
            window.closeAdminModal('csvImportModal');
            loadServicesModule();
          } else {
            showToast(json.error || 'CSV import failed.', 'error');
          }
        } catch (err) {
          showToast('Network error importing CSV.', 'error');
        }
      });
    }

    // System Settings Form
    const settingsForm = document.getElementById('systemSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const settings = {
          site_name: document.getElementById('setting_site_name').value,
          site_subtitle: document.getElementById('setting_site_subtitle').value,
          contact_email: document.getElementById('setting_contact_email').value,
          emergency_phone_national: document.getElementById('setting_emergency_phone_national').value,
          emergency_phone_disaster: document.getElementById('setting_emergency_phone_disaster').value,
          emergency_phone_ambulance: document.getElementById('setting_emergency_phone_ambulance').value,
          emergency_banner_text: document.getElementById('setting_emergency_banner_text').value
        };

        try {
          const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
          });
          const json = await res.json();
          if (json.success) {
            showToast('System settings saved successfully.', 'success');
          } else {
            showToast(json.error, 'error');
          }
        } catch (err) {
          showToast('Failed to save settings.', 'error');
        }
      });
    }

    // Search and filter input triggers
    document.getElementById('serviceSearchInput')?.addEventListener('input', () => {
      state.servicesPage = 1;
      loadServicesModule();
    });
    document.getElementById('serviceCategoryFilter')?.addEventListener('change', () => {
      state.servicesPage = 1;
      loadServicesModule();
    });
    document.getElementById('incidentStatusFilter')?.addEventListener('change', () => {
      state.incidentsPage = 1;
      loadIncidentsModule();
    });

    // Pagination buttons
    document.getElementById('servicesPrevBtn')?.addEventListener('click', () => {
      if (state.servicesPage > 1) {
        state.servicesPage--;
        loadServicesModule();
      }
    });
    document.getElementById('servicesNextBtn')?.addEventListener('click', () => {
      if (state.servicesPage < state.servicesTotalPages) {
        state.servicesPage++;
        loadServicesModule();
      }
    });

    // Initial module load
    switchModule('dashboard');
  });

})();
