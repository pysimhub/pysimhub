/**
 * Repository provider utilities for PySimHub.
 * The `github` field on a project holds any repository URL; the provider
 * (GitHub or GitLab) is derived from the URL so the UI can show the right
 * icon and label, and the data fetcher can hit the right API.
 */

export type RepoProvider = 'github' | 'gitlab';

/**
 * Detect the repository provider from a URL.
 * Returns null for unknown hosts.
 */
export function getRepoProvider(url: string): RepoProvider | null {
	if (!url) return null;
	if (url.includes('github.com')) return 'github';
	if (url.includes('gitlab.com')) return 'gitlab';
	return null;
}

export interface RepoLink {
	provider: RepoProvider | null;
	icon: 'github' | 'gitlab' | 'globe';
	label: string;
}

/**
 * Resolve the icon and label to show for a repository link.
 * Falls back to a generic globe icon for unknown hosts.
 */
export function getRepoLink(url: string): RepoLink {
	const provider = getRepoProvider(url);
	if (provider === 'gitlab') return { provider, icon: 'gitlab', label: 'GitLab' };
	if (provider === 'github') return { provider, icon: 'github', label: 'GitHub' };
	return { provider: null, icon: 'globe', label: 'Repository' };
}
