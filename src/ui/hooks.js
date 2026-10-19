import { useEffect, useState, useSyncExternalStore } from 'react';
import { progressStore, draftsStore, settingsStore } from '../game/progress.js';
import { loadLevel } from '../game/content.js';
import { onStatus, getStatus } from '../py/client.js';

export const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);
export const useDrafts = () => useSyncExternalStore(draftsStore.subscribe, draftsStore.get);
export const useSettings = () => useSyncExternalStore(settingsStore.subscribe, settingsStore.get);

export function usePyStatus() {
  const [s, setS] = useState(getStatus());
  useEffect(() => onStatus(setS), []);
  return s;
}

export function useLevel(code) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null });
    if (!code) return;
    loadLevel(code).then((data) => alive && setState({ data, error: null })).catch((e) => alive && setState({ data: null, error: e.message }));
    return () => { alive = false; };
  }, [code]);
  return state;
}

export function useHashRoute() {
  const read = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const f = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

export const go = (path) => { location.hash = '#/' + path; };

export function useMedia(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [query]);
  return m;
}
