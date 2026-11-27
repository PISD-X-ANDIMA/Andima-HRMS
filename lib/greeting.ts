import { useSyncExternalStore } from 'react';

export type Greeting = 'Good Morning' | 'Good Afternoon' | 'Good Evening';

// 03:00-11:59 morning, 12:00-16:59 afternoon, 17:00-02:59 evening.
export function greetingForHour(hour: number): Greeting {
  if (hour >= 3 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

function getClientGreeting(): Greeting {
  return greetingForHour(new Date().getHours());
}

function getServerGreeting(): null {
  return null;
}

// The greeting depends on the viewer's local clock, which the server does not
// know (it renders in UTC, or at build time for static pages). The server and
// the first client render both get null, so hydration matches; the browser
// then fills in its own local greeting and refreshes it every minute.
export function useGreeting(): Greeting | null {
  return useSyncExternalStore(subscribeToClock, getClientGreeting, getServerGreeting);
}
