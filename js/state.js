/**
 * State Manager for Starred Sessions & Compressed URL Encoding
 */
const STORAGE_KEY = 'javazone_2026_starred';
const URL_PARAM = 's';

/**
 * Encodes array of starred session IDs into compact Base64 URL parameter.
 */
export function encodeStarredToUrl(starredIds) {
  if (!starredIds || starredIds.length === 0) return '';
  try {
    const jsonStr = JSON.stringify(starredIds);
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return base64;
  } catch (e) {
    console.error('Error encoding starred state to URL:', e);
    return '';
  }
}

/**
 * Decodes URL parameter into array of session IDs.
 */
export function decodeStarredFromUrl(urlParam) {
  if (!urlParam) return [];
  try {
    const raw = decodeURIComponent(urlParam).trim();

    // 1. Try parsing directly as JSON
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      } catch (e) {}
    }

    // 2. Clean for Base64 (remove %20, spaces, newlines, tabs)
    let clean = raw.replace(/%20/g, '').replace(/\s+/g, '');
    let base64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);

    const arr = JSON.parse(jsonStr);
    if (Array.isArray(arr)) return arr;
  } catch (e) {
    // 3. Fallback: try comma-separated IDs
    try {
      const parts = urlParam.split(',').map((s) => decodeURIComponent(s).trim()).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => p.length > 5)) {
        return parts;
      }
    } catch (err) {}
    console.error('Error decoding starred state from URL:', e);
  }
  return [];
}

export class StateManager {
  constructor() {
    this.starred = new Set();
    this.initFromUrlAndStorage();
  }

  initFromUrlAndStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramVal = urlParams.get(URL_PARAM);

    if (paramVal) {
      const decoded = decodeStarredFromUrl(paramVal);
      decoded.forEach((id) => this.starred.add(id));
      this.saveToStorage();
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) {
            arr.forEach((id) => this.starred.add(id));
          }
        } catch (e) {}
      }
    }
    this.syncUrl();
  }

  isStarred(id) {
    return this.starred.has(id);
  }

  toggleStar(id) {
    if (this.starred.has(id)) {
      this.starred.delete(id);
    } else {
      this.starred.add(id);
    }
    this.saveToStorage();
    this.syncUrl();
  }

  getStarredArray() {
    return Array.from(this.starred);
  }

  saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.starred)));
  }

  syncUrl() {
    const arr = Array.from(this.starred);
    const paramVal = encodeStarredToUrl(arr);
    const url = new URL(window.location.href);

    if (paramVal) {
      url.searchParams.set(URL_PARAM, paramVal);
    } else {
      url.searchParams.delete(URL_PARAM);
    }

    window.history.replaceState({}, '', url.toString());
  }

  getShareableUrl() {
    return window.location.href;
  }
}
