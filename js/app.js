import { fetchSessions } from './api.js';
import { StateManager } from './state.js';

class App {
  constructor() {
    this.sessions = [];
    this.state = new StateManager();
    this.currentTab = 'all'; // 'all' or 'my'
    this.filters = {
      search: '',
      day: 'all',
      format: 'all',
      lang: 'all',
      hideFinished: false,
      view: 'grid'
    };

    this.initDOM();
    this.initEvents();
    this.loadData();
  }

  initDOM() {
    this.tabAll = document.getElementById('tab-all');
    this.tabMy = document.getElementById('tab-my');
    this.starCount = document.getElementById('star-count');
    this.shareBtn = document.getElementById('share-btn');
    this.searchInput = document.getElementById('search-input');
    this.viewChips = document.getElementById('view-chips');
    this.dayChips = document.getElementById('day-chips');
    this.formatChips = document.getElementById('format-chips');
    this.langChips = document.getElementById('lang-chips');
    this.hideFinishedCheckbox = document.getElementById('hide-finished-checkbox');
    this.container = document.getElementById('schedule-container');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalClose = document.getElementById('modal-close');
    this.modalBody = document.getElementById('modal-body');
    this.toast = document.getElementById('toast');
  }

  initEvents() {
    // Navigation tabs
    this.tabAll.addEventListener('click', () => this.switchTab('all'));
    this.tabMy.addEventListener('click', () => this.switchTab('my'));

    // Share button
    this.shareBtn.addEventListener('click', () => this.shareSchedule());

    // Search
    this.searchInput.addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase().trim();
      this.render();
    });

    // Chip filter handlers
    if (this.viewChips) this.bindChips(this.viewChips, 'view');
    this.bindChips(this.dayChips, 'day');
    this.bindChips(this.formatChips, 'format');
    this.bindChips(this.langChips, 'lang');

    // Hide finished checkbox
    if (this.hideFinishedCheckbox) {
      this.hideFinishedCheckbox.addEventListener('change', (e) => {
        this.filters.hideFinished = e.target.checked;
        this.render();
      });
    }

    // Modal close
    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  bindChips(container, filterKey) {
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.filters[filterKey] = chip.dataset[filterKey];
        this.render();
      });
    });
  }

  async loadData() {
    this.container.innerHTML = '<div class="empty-state">Loading schedule...</div>';
    this.sessions = await fetchSessions();
    this.updateStarCount();
    this.render();
  }

  switchTab(tab) {
    this.currentTab = tab;
    if (tab === 'all') {
      this.tabAll.classList.add('active');
      this.tabMy.classList.remove('active');
    } else {
      this.tabMy.classList.add('active');
      this.tabAll.classList.remove('active');
    }
    this.render();
  }

  updateStarCount() {
    const count = this.state.getStarredArray().length;
    this.starCount.textContent = `(${count})`;
  }

  getFilteredSessions() {
    return this.sessions.filter((s) => {
      // My Schedule Tab filter
      if (this.currentTab === 'my' && !this.state.isStarred(s.id)) {
        return false;
      }

      // Day filter
      if (this.filters.day !== 'all' && s.dateDay !== this.filters.day) {
        return false;
      }

      // Format filter
      if (this.filters.format !== 'all' && s.format !== this.filters.format) {
        return false;
      }

      // Language filter
      if (this.filters.lang !== 'all' && s.language !== this.filters.lang) {
        return false;
      }

      // Hide finished sessions filter
      if (this.filters.hideFinished && s.endMs) {
        if (s.endMs < Date.now()) {
          return false;
        }
      }

      // Search text
      if (this.filters.search) {
        const q = this.filters.search;
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesAbstract = s.abstract.toLowerCase().includes(q);
        const matchesAudience = (s.intendedAudience || '').toLowerCase().includes(q);
        const matchesSpeakers = s.speakers.some((sp) => {
          const name = typeof sp === 'string' ? sp : sp.name || '';
          const bio = typeof sp === 'object' && sp ? sp.bio || '' : '';
          return name.toLowerCase().includes(q) || bio.toLowerCase().includes(q);
        });
        const matchesRoom = s.room.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAbstract && !matchesAudience && !matchesSpeakers && !matchesRoom) {
          return false;
        }
      }

      return true;
    });
  }

  getMinFromTime(s) {
    if (s.startMs) {
      const d = new Date(s.startMs);
      return d.getHours() * 60 + d.getMinutes();
    }
    if (s.timeFormatted) {
      const [h, m] = s.timeFormatted.split(':').map(Number);
      return h * 60 + m;
    }
    return 540;
  }

  render() {
    const list = this.getFilteredSessions();

    if (list.length === 0) {
      if (this.currentTab === 'my') {
        this.container.innerHTML = `
          <div class="empty-state">
            <h3>No sessions starred yet</h3>
            <p>Click the star (★) on any session to add it to your personal schedule!</p>
          </div>
        `;
      } else {
        this.container.innerHTML = `
          <div class="empty-state">
            <h3>No sessions found</h3>
            <p>Try adjusting your search or filter options.</p>
          </div>
        `;
      }
      return;
    }

    if (this.filters.view === 'matrix') {
      this.renderMatrix(list);
    } else {
      this.renderGrid(list);
    }

    // Attach card event listeners
    this.container.querySelectorAll('.session-card, .matrix-card').forEach((card) => {
      const id = card.dataset.id;
      const starBtn = card.querySelector('.star-btn');

      if (starBtn) {
        starBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.toggleStar(id);
          this.updateStarCount();
          this.render();
        });
      }

      card.addEventListener('click', () => {
        const session = this.sessions.find((s) => s.id === id);
        if (session) this.openModal(session);
      });
    });
  }

  renderGrid(list) {
    // Group sessions by dateDay then by timeFormatted
    const grouped = {};
    list.forEach((s) => {
      const day = s.dateDay || 'Tue';
      const time = s.timeFormatted || '09:00';
      if (!grouped[day]) grouped[day] = {};
      if (!grouped[day][time]) grouped[day][time] = [];
      grouped[day][time].push(s);
    });

    let html = '';
    const dayNames = { Tue: 'Tuesday, Sep 1', Wed: 'Wednesday, Sep 2', Thu: 'Thursday, Sep 3' };
    const dayOrder = ['Tue', 'Wed', 'Thu'];

    // Sort days explicitly so Tuesday comes first
    const sortedDays = dayOrder.filter((d) => grouped[d]);
    Object.keys(grouped).forEach((d) => {
      if (!sortedDays.includes(d)) sortedDays.push(d);
    });

    sortedDays.forEach((dayKey) => {
      html += `<h2 style="margin: 2rem 0 1rem 0; color: var(--accent-color); font-size: 1.5rem; border-bottom: 1px solid var(--card-border); padding-bottom: 0.5rem;">${dayNames[dayKey] || dayKey}</h2>`;

      Object.keys(grouped[dayKey]).sort().forEach((timeKey) => {
        const slotSessions = grouped[dayKey][timeKey];

        html += `
          <div class="time-slot">
            <div class="slot-header">
              <div class="slot-time">${timeKey}</div>
              <div class="slot-line"></div>
            </div>
            <div class="session-grid">
              ${slotSessions.map((s) => this.renderCard(s)).join('')}
            </div>
          </div>
        `;
      });
    });

    this.container.innerHTML = html;
  }

  renderMatrix(list) {
    const groupedByDay = {};
    list.forEach((s) => {
      const day = s.dateDay || 'Tue';
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(s);
    });

    const dayNames = { Tue: 'Tuesday, Sep 1', Wed: 'Wednesday, Sep 2', Thu: 'Thursday, Sep 3' };
    const dayOrder = ['Tue', 'Wed', 'Thu'];

    const sortedDays = dayOrder.filter((d) => groupedByDay[d]);
    Object.keys(groupedByDay).forEach((d) => {
      if (!sortedDays.includes(d)) sortedDays.push(d);
    });

    const knownRoomOrder = [
      'Room I', 'Room II', 'Room III', 'Room IV', 'Room V', 'Room VI', 'Room VII',
      'Workshop A', 'Workshop B', 'Workshop C', 'Workshop D', 'Workshop E'
    ];

    const PX_PER_MIN = 3.2;
    const TOP_OFFSET = 12;
    let html = '';

    sortedDays.forEach((dayKey) => {
      const daySessions = groupedByDay[dayKey];
      const dayRooms = Array.from(new Set(daySessions.map((s) => s.room))).sort((a, b) => {
        const ia = knownRoomOrder.indexOf(a);
        const ib = knownRoomOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });

      let minMin = 24 * 60;
      let maxMin = 0;
      const startMinsSet = new Set();

      daySessions.forEach((s) => {
        const startMin = this.getMinFromTime(s);
        const durMin = parseInt(s.length, 10) || 45;
        const endMin = startMin + durMin;
        if (startMin < minMin) minMin = startMin;
        if (endMin > maxMin) maxMin = endMin;
        startMinsSet.add(startMin);
      });

      if (minMin >= maxMin) {
        minMin = 540;
        maxMin = 1080;
        startMinsSet.add(540);
      }

      const gridStartMin = minMin;
      const totalMins = maxMin - gridStartMin;
      const totalHeight = totalMins * PX_PER_MIN + TOP_OFFSET + 30;

      const sortedStartMins = Array.from(startMinsSet).sort((a, b) => a - b);

      let timeMarkersHtml = '';
      let gridLinesHtml = '';

      sortedStartMins.forEach((mins) => {
        const topPx = (mins - gridStartMin) * PX_PER_MIN + TOP_OFFSET;
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        const label = `${hh}:${mm}`;

        timeMarkersHtml += `<div class="time-marker" style="top: ${topPx}px;">${label}</div>`;
        gridLinesHtml += `<div class="time-grid-line" style="top: ${topPx}px;"></div>`;
      });

      html += `
        <div class="matrix-day-section">
          <h2 class="matrix-day-title">${dayNames[dayKey] || dayKey}</h2>
          <div class="matrix-wrapper">
            <div class="matrix-grid" style="grid-template-columns: 50px repeat(${dayRooms.length}, minmax(130px, 1fr));">
              <div class="matrix-header-cell time-header">Time</div>
              ${dayRooms.map((r) => `<div class="matrix-header-cell room-header" title="${this.escapeHtml(r)}">${this.escapeHtml(r)}</div>`).join('')}

              <div class="matrix-time-col" style="height: ${totalHeight}px;">
                ${timeMarkersHtml}
              </div>

              ${dayRooms.map((r) => {
                const roomSessions = daySessions.filter((s) => s.room === r);
                return `
                  <div class="matrix-room-col" style="height: ${totalHeight}px;">
                    ${gridLinesHtml}
                    ${roomSessions.map((s) => this.renderMatrixCard(s, gridStartMin, PX_PER_MIN, TOP_OFFSET)).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    });

    this.container.innerHTML = html;
  }

  renderMatrixCard(s, gridStartMin, PX_PER_MIN, TOP_OFFSET = 12) {
    const startMin = this.getMinFromTime(s);
    const durMin = parseInt(s.length, 10) || 45;
    const topPx = (startMin - gridStartMin) * PX_PER_MIN + TOP_OFFSET;
    const heightPx = Math.max(durMin * PX_PER_MIN - 2, 40);

    const isStarred = this.state.isStarred(s.id);
    const starClass = isStarred ? 'starred' : '';
    const starSymbol = isStarred ? '★' : '☆';
    const isShort = durMin <= 20 || heightPx < 50;
    const shortClass = isShort ? 'short-card' : '';

    return `
      <div class="matrix-card format-${s.format} ${shortClass}" data-id="${s.id}" style="top: ${topPx}px; height: ${heightPx}px; --card-height: ${heightPx}px;" title="${this.escapeHtml(s.title)} (${s.timeFormatted}, ${s.length} min)">
        <div class="session-title">${this.escapeHtml(s.title)}</div>
        <div class="matrix-card-footer">
          <button class="star-btn ${starClass}" title="Star session">${starSymbol}</button>
        </div>
      </div>
    `;
  }

  renderCard(s) {
    const isStarred = this.state.isStarred(s.id);
    const starClass = isStarred ? 'starred' : '';
    const starSymbol = isStarred ? '★' : '☆';

    return `
      <div class="session-card" data-id="${s.id}">
        <div>
          <div class="card-top">
            <div class="card-tags">
              <span class="badge badge-${s.format}">${s.format}</span>
              <span class="badge badge-lang">${s.language.toUpperCase()}</span>
            </div>
            <button class="star-btn ${starClass}" title="Star session">${starSymbol}</button>
          </div>
          <div class="session-title">${this.escapeHtml(s.title)}</div>
        </div>
        <div>
          <div class="session-meta">
            <span>📍 ${this.escapeHtml(s.room)}</span>
            <span>⏱ ${s.length} min</span>
          </div>
          <div class="session-speakers">
            ${s.speakers.map((sp) => this.escapeHtml(typeof sp === 'string' ? sp : sp.name)).join(', ')}
          </div>
        </div>
      </div>
    `;
  }

  openModal(s) {
    const isStarred = this.state.isStarred(s.id);
    const starClass = isStarred ? 'starred' : '';
    const starSymbol = isStarred ? '★ Starred' : '☆ Star';
    const speakerNames = s.speakers.map((sp) => typeof sp === 'string' ? sp : sp.name).join(', ');

    let html = `
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="badge badge-${s.format}">${s.format}</span>
        <span class="badge badge-lang">${s.language.toUpperCase()}</span>
      </div>
      <div class="modal-title">${this.escapeHtml(s.title)}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--card-border); padding-bottom: 1rem;">
        <div>
          <div style="color: var(--accent-color); font-weight: 600;">${this.escapeHtml(speakerNames)}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">📍 ${this.escapeHtml(s.room)} • ⏱ ${s.length} mins • ${s.dateDay} ${s.timeFormatted}</div>
        </div>
        <button id="modal-star-btn" class="star-btn ${starClass}" style="font-size: 1rem; border: 1px solid var(--card-border); padding: 0.4rem 0.8rem; border-radius: 6px; background: #0b0f19;">${starSymbol}</button>
      </div>
      <div class="modal-abstract">${this.escapeHtml(s.abstract)}</div>
    `;

    if (s.intendedAudience) {
      html += `
        <div class="modal-section">
          <div class="modal-section-title">🎯 Intended Audience</div>
          <div class="modal-section-content">${this.escapeHtml(s.intendedAudience)}</div>
        </div>
      `;
    }

    if (s.suggestedKeywords) {
      const keywords = s.suggestedKeywords.split(',').map((k) => k.trim()).filter(Boolean);
      if (keywords.length > 0) {
        html += `
          <div class="modal-section">
            <div class="modal-section-title">🏷 Keywords</div>
            <div class="modal-keywords">
              ${keywords.map((k) => `<span class="keyword-tag">${this.escapeHtml(k)}</span>`).join('')}
            </div>
          </div>
        `;
      }
    }

    if (s.speakers && s.speakers.length > 0) {
      const hasDetails = s.speakers.some((sp) => typeof sp === 'object' && (sp.bio || sp.bluesky || sp.linkedin || sp.twitter || sp.pictureUrl));
      if (hasDetails) {
        html += `
          <div class="modal-section">
            <div class="modal-section-title">👤 ${s.speakers.length > 1 ? 'Presenters' : 'Presenter'}</div>
            <div class="modal-speakers-list">
              ${s.speakers.map((sp) => {
                const name = typeof sp === 'string' ? sp : sp.name;
                const bio = typeof sp === 'object' ? sp.bio || '' : '';
                const bluesky = typeof sp === 'object' ? sp.bluesky || '' : '';
                const linkedin = typeof sp === 'object' ? sp.linkedin || '' : '';
                const twitter = typeof sp === 'object' ? sp.twitter || '' : '';
                const pictureUrl = typeof sp === 'object' ? sp.pictureUrl || '' : '';

                let linksHtml = '';
                if (bluesky) {
                  const bskyUrl = bluesky.startsWith('http') ? bluesky : `https://bsky.app/profile/${bluesky.replace(/^@/, '')}`;
                  linksHtml += `<a href="${this.escapeHtml(bskyUrl)}" target="_blank" rel="noopener" class="speaker-social-link">🦋 ${this.escapeHtml(bluesky)}</a>`;
                }
                if (linkedin) {
                  const liUrl = linkedin.startsWith('http') ? linkedin : `https://www.linkedin.com/in/${linkedin}`;
                  linksHtml += `<a href="${this.escapeHtml(liUrl)}" target="_blank" rel="noopener" class="speaker-social-link">💼 LinkedIn</a>`;
                }
                if (twitter) {
                  const twUrl = twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter.replace(/^@/, '')}`;
                  linksHtml += `<a href="${this.escapeHtml(twUrl)}" target="_blank" rel="noopener" class="speaker-social-link">🐦 ${this.escapeHtml(twitter)}</a>`;
                }

                return `
                  <div class="speaker-card">
                    <div class="speaker-card-header">
                      ${pictureUrl ? `<img src="${this.escapeHtml(pictureUrl)}" class="speaker-avatar" alt="${this.escapeHtml(name)}" />` : ''}
                      <div>
                        <div class="speaker-card-name">${this.escapeHtml(name)}</div>
                        ${linksHtml ? `<div class="speaker-social-links">${linksHtml}</div>` : ''}
                      </div>
                    </div>
                    ${bio ? `<div class="speaker-card-bio">${this.escapeHtml(bio)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    }

    this.modalBody.innerHTML = html;

    document.getElementById('modal-star-btn').addEventListener('click', () => {
      this.state.toggleStar(s.id);
      this.updateStarCount();
      this.openModal(s);
      this.render();
    });

    this.modalOverlay.classList.add('open');
  }

  closeModal() {
    this.modalOverlay.classList.remove('open');
  }

  shareSchedule() {
    const url = this.state.getShareableUrl();
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Shareable schedule URL copied to clipboard!');
    }).catch(() => {
      this.showToast('Copied URL to clipboard!');
    });
  }

  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2500);
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
