import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
	if (!browser) return 'dark';

	const urlTheme = new URL(window.location.href).searchParams.get('theme');
	if (urlTheme === 'dark' || urlTheme === 'light') {
		localStorage.setItem('theme', urlTheme);
		document.documentElement.classList.remove('dark', 'light');
		document.documentElement.classList.add(urlTheme);
		return urlTheme;
	}

	const stored = localStorage.getItem('theme') as Theme | null;
	if (stored === 'dark' || stored === 'light') return stored;

	if (window.matchMedia('(prefers-color-scheme: light)').matches) {
		return 'light';
	}

	return 'dark';
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getInitialTheme());

	return {
		subscribe,
		toggle: () => {
			update((current) => {
				const newTheme = current === 'dark' ? 'light' : 'dark';
				if (browser) {
					localStorage.setItem('theme', newTheme);
					document.documentElement.classList.remove('dark', 'light');
					document.documentElement.classList.add(newTheme);
				}
				return newTheme;
			});
		},
		set: (theme: Theme) => {
			if (browser) {
				localStorage.setItem('theme', theme);
				document.documentElement.classList.remove('dark', 'light');
				document.documentElement.classList.add(theme);
			}
			set(theme);
		}
	};
}

export const theme = createThemeStore();
