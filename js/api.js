/**
 * Fetch JavaZone sessions from SleepingPill API with fallbacks.
 */
export async function fetchSessions() {
  const endpoints = [
    'https://sleepingpill.javazone.no/public/allSessions/javazone_2026',
    'https://sleepingpill.javazone.no/public/allSessions/javazone_2025',
    './data/sessions-fallback.json'
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data && Array.isArray(data.sessions) && data.sessions.length > 0) {
        return normalizeSessions(data.sessions);
      }
    } catch (err) {
      console.warn(`Failed to fetch from ${url}:`, err);
    }
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

    if (startTime) {
      try {
        const d = new Date(startTime);
        if (!isNaN(d.getTime())) {
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

    const speakers = Array.isArray(s.speakers)
      ? s.speakers.map((sp) => typeof sp === 'string' ? sp : sp.name).filter(Boolean)
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
      dateDay,
      timeFormatted,
      speakers,
      intendedAudience: s.intendedAudience || '',
      suggestedKeywords: s.suggestedKeywords || ''
    };
  });
}
