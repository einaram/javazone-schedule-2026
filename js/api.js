/**
 * Fetch JavaZone sessions from SleepingPill API with fallbacks and browser caching.
 */
const CACHE_KEY = 'javazone_2026_all_sessions_cache_v2';

export async function fetchSessions() {
  const remoteEndpoints = [
    'https://sleepingpill.javazone.no/public/allSessions/javazone_2026'
  ];

  for (const url of remoteEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) continue;
      const data = await response.json();
      if (data && Array.isArray(data.sessions) && data.sessions.length > 0) {
        const normalized = normalizeSessions(data.sessions);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
        } catch (e) {
          console.warn('Failed to save sessions to localStorage:', e);
        }
        return normalized;
      }
    } catch (err) {
      console.warn(`Failed to fetch from ${url}:`, err);
    }
  }

  // If remote endpoints failed or timed out, try loading from browser localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('Serving session data from browser localStorage cache');
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading session cache from localStorage:', e);
  }

  // Final fallback to static json file
  try {
    const response = await fetch('./data/sessions-fallback.json');
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.sessions) && data.sessions.length > 0) {
        return normalizeSessions(data.sessions);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch static fallback JSON:', err);
  }

  // Last resort fallback empty array if fetch fails entirely
  return [];
}

/**
 * Normalizes session objects across API variations.
 */
function normalizeSessions(sessions) {
  return sessions.map((s) => {
    const id = s.id || s.sessionId || String(Math.random());
    const title = (s.title || 'Untitled Session').trim();
    const format = (s.format || 'presentation').toLowerCase();
    const language = (s.language || 'en').toLowerCase();
    const room = (s.room || 'TBA').trim();
    const length = s.length ? String(s.length) : '45';

    // Derive ISO date & slot
    let startTime = s.startTime || s.startSlot || '';
    let endTime = s.endTime || '';

    let dateDay = 'Tue'; // Default fallback day
    let timeFormatted = '09:00';
    let startMs = 0;
    let endMs = 0;

    if (startTime) {
      try {
        const d = new Date(startTime);
        if (!isNaN(d.getTime())) {
          startMs = d.getTime();
          const dayNum = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu...
          if (dayNum === 2) dateDay = 'Tue';
          else if (dayNum === 3) dateDay = 'Wed';
          else if (dayNum === 4) dateDay = 'Thu';
          else dateDay = 'Tue';

          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          timeFormatted = `${hh}:${mm}`;
        }
      } catch (e) {}
    }

    if (endTime) {
      try {
        const d = new Date(endTime);
        if (!isNaN(d.getTime())) {
          endMs = d.getTime();
        }
      } catch (e) {}
    }

    if (!endMs && startMs) {
      const durationMins = parseInt(length, 10) || 45;
      endMs = startMs + durationMins * 60 * 1000;
    }

    const speakers = Array.isArray(s.speakers)
      ? s.speakers
          .map((sp) => {
            if (typeof sp === 'string') {
              return { name: sp.trim(), bio: '', twitter: '', linkedin: '', bluesky: '', pictureUrl: '' };
            }
            if (typeof sp === 'object' && sp !== null) {
              const pictureUrl = sp.pictureUrl || sp.picture || (sp.pictureId ? `https://sleepingpill.javazone.no/public/picture/${sp.pictureId}` : '');
              return {
                name: (sp.name || '').trim(),
                bio: sp.bio || '',
                twitter: sp.twitter || '',
                linkedin: sp.linkedin || '',
                bluesky: sp.bluesky || '',
                pictureUrl: pictureUrl || ''
              };
            }
            return null;
          })
          .filter((sp) => sp && sp.name)
      : [];

    return {
      id,
      title,
      abstract: s.abstract || 'No abstract available.',
      format,
      language,
      room,
      length,
      startTime,
      endTime,
      startMs,
      endMs,
      dateDay,
      timeFormatted,
      speakers,
      intendedAudience: s.intendedAudience || '',
      suggestedKeywords: s.suggestedKeywords || ''
    };
  });
}
