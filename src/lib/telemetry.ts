import { eventBus } from './engine/events/GameEventBus.js';

const SESSION_KEY = 'gitvana-session-id';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function trackEvent(type: string, levelId?: string | null, data?: Record<string, unknown>): void {
  try {
    const payload = JSON.stringify({
      type,
      levelId: levelId || undefined,
      data: data || undefined,
      sessionId: getSessionId(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/events', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently ignore — never break gameplay
  }
}

// Command tracking throttle
let lastCommandTime = 0;
const COMMAND_THROTTLE = 1000; // 1 second
let currentLevelId: string | null = null;

export function initTelemetry(): void {
  // Session start
  trackEvent('session', null, {
    returning: !!localStorage.getItem('gitvana-save'),
    screen: `${window.innerWidth}x${window.innerHeight}`,
    referrer: document.referrer || undefined,
  });

  // Level events via event bus
  eventBus.on('level:loaded', ({ levelId }) => {
    currentLevelId = levelId;
    trackEvent('level_start', levelId);
  });

  eventBus.on('level:completed', ({ levelId, stars }) => {
    trackEvent('level_complete', levelId, { stars });
  });

  // Command tracking (throttled, includes levelId)
  eventBus.on('command:executed', ({ command, success }) => {
    const now = Date.now();
    if (now - lastCommandTime < COMMAND_THROTTLE) return;
    lastCommandTime = now;
    trackEvent('command', currentLevelId, { cmd: command, ok: success });
  });
}

export { trackEvent };
