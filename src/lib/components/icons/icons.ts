// Icon definitions for the PySimHub icon library
// Each icon has a type (fill or stroke), viewBox, and path(s)

export type IconType = 'fill' | 'stroke';

export interface IconDefinition {
	type: IconType;
	viewBox: string;
	path: string;
	// For icons with multiple paths
	paths?: string[];
}

export const icons = {
	// Social/Branding
	github: {
		type: 'fill' as const,
		viewBox: '0 0 24 24',
		path: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'
	},
	gitlab: {
		type: 'fill' as const,
		viewBox: '0 0 24 24',
		path: 'M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.919 1.263a.455.455 0 00-.867 0L1.388 9.452.045 13.587a.924.924 0 00.331 1.023L12 23.054l11.624-8.443a.924.924 0 00.331-1.024'
	},

	// Content - filled star
	star: {
		type: 'fill' as const,
		viewBox: '0 0 20 20',
		path: 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z'
	},

	// Navigation/UI
	close: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M6 18L18 6M6 6l12 12'
	},

	'chevron-down': {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M19 9l-7 7-7-7'
	},

	'chevron-up': {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M5 15l7-7 7 7'
	},

	hamburger: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M4 6h16M4 12h16M4 18h16'
	},

	'arrow-right': {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M14 5l7 7m0 0l-7 7m7-7H3'
	},

	// Actions
	search: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
	},

	plus: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M12 4v16m8-8H4'
	},

	pencil: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
	},

	trash: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
	},

	check: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M5 13l4 4L19 7'
	},

	sort: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12'
	},

	// Content/Metadata
	calendar: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
	},

	clock: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
	},

	fork: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
	},

	tag: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'
	},

	shield: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
	},

	docs: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
	},

	package: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
	},

	globe: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9'
	},

	play: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
		paths: [
			'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
			'M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		]
	},

	user: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
	},

	// Theme
	sun: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
	},

	moon: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z'
	},

	// Status/Feedback
	'sad-face': {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	},

	document: {
		type: 'stroke' as const,
		viewBox: '0 0 24 24',
		path: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
	}
} as const;

export type IconName = keyof typeof icons;
