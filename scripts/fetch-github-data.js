#!/usr/bin/env node

/**
 * Script to fetch repository data for all projects and cache it locally.
 * Supports both GitHub and GitLab repositories; the provider is detected from
 * each project's repo URL and the matching API is used. Both write into the
 * same cache shape, so the frontend treats them identically.
 *
 * Run this periodically (e.g., via GitHub Actions) to update the cache.
 *
 * Usage: node scripts/fetch-github-data.js
 *
 * Tokens (optional, for higher rate limits):
 *   GITHUB_TOKEN - https://github.com/settings/tokens (no scopes needed for public repos)
 *   GITLAB_TOKEN - https://gitlab.com/-/user_settings/personal_access_tokens (read_api scope)
 * Public repos work without tokens, just with lower rate limits.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GitHub Personal Access Token for higher rate limits
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'YOUR_GITHUB_TOKEN_HERE';
const hasGitHubToken = GITHUB_TOKEN && GITHUB_TOKEN !== 'YOUR_GITHUB_TOKEN_HERE';

// GitLab Personal Access Token (optional, public repos work without it)
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || '';
const hasGitLabToken = Boolean(GITLAB_TOKEN);

const githubHeaders = {
	'Accept': 'application/vnd.github.v3+json',
	'User-Agent': 'PySimHub',
	...(hasGitHubToken ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {})
};

const gitlabHeaders = {
	'User-Agent': 'PySimHub',
	...(hasGitLabToken ? { 'PRIVATE-TOKEN': GITLAB_TOKEN } : {})
};

const GITLAB_HOST = 'https://gitlab.com';

/**
 * Detect the repository provider from a URL.
 */
function getProvider(url) {
	if (!url) return null;
	if (url.includes('github.com')) return 'github';
	if (url.includes('gitlab.com')) return 'gitlab';
	return null;
}

function parseGitHubUrl(url) {
	const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
	if (!match) return null;
	return {
		owner: match[1],
		repo: match[2].replace(/\.git$/, '')
	};
}

/**
 * Extract the URL-encoded "namespace/project" path from a GitLab URL.
 * Handles nested groups (e.g. group/subgroup/repo) and strips GitLab's
 * /-/ sub-routes, query strings and trailing .git.
 */
function parseGitLabPath(url) {
	const match = url.match(/gitlab\.com\/(.+)/);
	if (!match) return null;
	let path = match[1]
		.split(/[?#]/)[0] // drop query/hash
		.split('/-/')[0] // drop GitLab sub-routes like /-/tree/main
		.replace(/\.git$/, '')
		.replace(/^\/+|\/+$/g, '');
	if (!path) return null;
	return encodeURIComponent(path);
}

async function fetchWithRetry(url, headers, retries = 3) {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, { headers });

			if (response.status === 403 || response.status === 429) {
				const remaining = response.headers.get('X-RateLimit-Remaining') || response.headers.get('RateLimit-Remaining');
				const resetTime = response.headers.get('X-RateLimit-Reset') || response.headers.get('RateLimit-Reset');
				console.warn(`Rate limited. Remaining: ${remaining}, Reset: ${resetTime ? new Date(resetTime * 1000).toISOString() : 'unknown'}`);
				if (remaining === '0' && resetTime) {
					const waitTime = Math.max(0, (resetTime * 1000) - Date.now() + 1000);
					console.log(`Waiting ${Math.round(waitTime / 1000)}s for rate limit reset...`);
					await new Promise(resolve => setTimeout(resolve, waitTime));
					continue;
				}
			}

			if (!response.ok) {
				if (response.status === 404) return null;
				throw new Error(`HTTP ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			if (i === retries - 1) throw error;
			await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
		}
	}
}

/**
 * Fetch repo data from GitHub and map it to the cache shape.
 */
async function fetchGitHub(project) {
	const parsed = parseGitHubUrl(project.github);
	if (!parsed) {
		console.warn(`Invalid GitHub URL for ${project.name}: ${project.github}`);
		return null;
	}
	const { owner, repo } = parsed;
	console.log(`Fetching ${owner}/${repo} (GitHub)...`);

	const [repoData, latestRelease] = await Promise.all([
		fetchWithRetry(`https://api.github.com/repos/${owner}/${repo}`, githubHeaders),
		fetchWithRetry(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, githubHeaders)
	]);

	if (!repoData) return null;

	return {
		stars: repoData.stargazers_count,
		forks: repoData.forks_count,
		lastUpdate: repoData.pushed_at,
		description: repoData.description,
		license: repoData.license?.spdx_id,
		avatarUrl: `https://github.com/${owner}.png?size=128`,
		lastRelease: latestRelease?.published_at || null,
		releaseVersion: latestRelease?.tag_name || null,
		fetchedAt: new Date().toISOString()
	};
}

/**
 * Fetch repo data from GitLab and map it to the same cache shape.
 */
async function fetchGitLab(project) {
	const path = parseGitLabPath(project.github);
	if (!path) {
		console.warn(`Invalid GitLab URL for ${project.name}: ${project.github}`);
		return null;
	}
	console.log(`Fetching ${decodeURIComponent(path)} (GitLab)...`);

	const [repoData, releases] = await Promise.all([
		fetchWithRetry(`${GITLAB_HOST}/api/v4/projects/${path}?license=true`, gitlabHeaders),
		fetchWithRetry(`${GITLAB_HOST}/api/v4/projects/${path}/releases?per_page=1`, gitlabHeaders)
	]);

	if (!repoData) return null;

	// Project avatar is absolute; namespace avatar is host-relative.
	let avatarUrl = repoData.avatar_url || null;
	if (!avatarUrl && repoData.namespace?.avatar_url) {
		const nsAvatar = repoData.namespace.avatar_url;
		avatarUrl = nsAvatar.startsWith('http') ? nsAvatar : `${GITLAB_HOST}${nsAvatar}`;
	}

	const latestRelease = Array.isArray(releases) && releases.length > 0 ? releases[0] : null;

	return {
		stars: repoData.star_count,
		forks: repoData.forks_count,
		lastUpdate: repoData.last_activity_at,
		description: repoData.description,
		license: repoData.license?.nickname || repoData.license?.name,
		avatarUrl,
		lastRelease: latestRelease?.released_at || null,
		releaseVersion: latestRelease?.tag_name || null,
		fetchedAt: new Date().toISOString()
	};
}

async function main() {
	console.log('Fetching repository data for projects...');
	console.log(hasGitHubToken ? 'GitHub: authenticated (5000 req/hr)' : 'GitHub: unauthenticated (60 req/hr) - set GITHUB_TOKEN for more');
	console.log(hasGitLabToken ? 'GitLab: authenticated' : 'GitLab: unauthenticated - set GITLAB_TOKEN for more');
	console.log('');

	const projectsPath = join(__dirname, '..', 'static', 'data', 'projects.json');
	const projects = JSON.parse(readFileSync(projectsPath, 'utf-8'));

	const githubData = {};

	for (const project of projects) {
		const provider = getProvider(project.github);

		if (!provider) {
			console.warn(`Unknown repo host for ${project.name}: ${project.github} (will use manualStats if present)`);
			continue;
		}

		try {
			const data = provider === 'gitlab' ? await fetchGitLab(project) : await fetchGitHub(project);
			if (data) {
				githubData[project.id] = data;
				const versionInfo = data.releaseVersion ? ` (${data.releaseVersion})` : '';
				console.log(`  ✓ ${data.stars} stars${versionInfo}`);
			} else {
				console.warn(`  ✗ Failed to fetch repo data`);
			}
		} catch (error) {
			console.error(`  ✗ Error fetching ${project.name}:`, error.message);
		}

		// Small delay to be nice to the APIs
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	const cachePath = join(__dirname, '..', 'static', 'data', 'github-cache.json');
	writeFileSync(cachePath, JSON.stringify(githubData, null, '\t'));
	console.log(`\nWrote cache to ${cachePath}`);
	console.log(`Cached ${Object.keys(githubData).length}/${projects.length} projects`);
}

main().catch(console.error);
