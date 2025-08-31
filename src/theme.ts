export type Theme = 'light' | 'dark' | 'system';

let mediaListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null = null;

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  const set = (isDark: boolean) => {
    root.classList.toggle('dark', isDark);
  };

  if (mediaListener) {
    prefersDark.removeEventListener('change', mediaListener);
    mediaListener = null;
  }

  if (theme === 'system') {
    set(prefersDark.matches);
    mediaListener = (e) => set(e.matches);
    prefersDark.addEventListener('change', mediaListener);
  } else {
    set(theme === 'dark');
  }
}

