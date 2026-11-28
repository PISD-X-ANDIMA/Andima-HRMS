import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Greeting by the visitor's local hour (UI-006). The server renders in UTC, so it renders a neutral word and the
 * browser switches to its own hour after hydration instead of the server's.
 */
export function useGreeting(): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      const hour = new Date().getHours();
      return hour >= 3 && hour < 12 ? 'Good Morning' : hour >= 12 && hour < 17 ? 'Good Afternoon' : 'Good Evening';
    },
    () => 'Welcome',
  );
}
