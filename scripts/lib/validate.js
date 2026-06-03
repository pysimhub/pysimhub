/**
 * Validation helpers for project data.
 * Used by scripts/validate-projects.js (CI + local) and by process-submission
 * as a final guard before a PR is opened.
 */

import {
	ID_PATTERN,
	REQUIRED_FIELDS,
	OPTIONAL_URL_FIELDS,
	REPO_FIELD,
	TAG_ALLOWED
} from './constants.js';

/** True for a syntactically valid http(s) URL. */
export function isValidHttpUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/** Normalize a repo URL for duplicate detection (lowercase host, strip .git / trailing slash). */
export function normalizeRepoUrl(value) {
	try {
		const url = new URL(value);
		const host = url.host.toLowerCase();
		const path = url.pathname.replace(/\.git$/, '').replace(/\/+$/, '');
		return `${host}${path}`.toLowerCase();
	} catch {
		return (value || '').trim().toLowerCase();
	}
}

/** Sanitize a single tag to the allowed character set; returns '' if nothing remains. */
export function sanitizeTag(tag) {
	return String(tag)
		.toLowerCase()
		.replace(TAG_ALLOWED, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Validate a single project object. Returns an array of error strings (empty if valid).
 */
export function validateProject(project) {
	const errors = [];
	const label = project?.id || project?.name || '(unknown)';

	for (const field of REQUIRED_FIELDS) {
		if (project[field] === undefined || project[field] === null || project[field] === '') {
			errors.push(`${label}: missing required field "${field}"`);
		}
	}

	if (project.id && !ID_PATTERN.test(project.id)) {
		errors.push(`${label}: id "${project.id}" must match ${ID_PATTERN}`);
	}

	if (project.github && !isValidHttpUrl(project.github)) {
		errors.push(`${label}: ${REPO_FIELD} "${project.github}" is not a valid URL`);
	}

	if (project.tags !== undefined) {
		if (!Array.isArray(project.tags) || project.tags.length === 0) {
			errors.push(`${label}: tags must be a non-empty array`);
		} else if (project.tags.some((t) => typeof t !== 'string' || t.trim() === '')) {
			errors.push(`${label}: tags must all be non-empty strings`);
		}
	}

	for (const field of OPTIONAL_URL_FIELDS) {
		const value = project[field];
		if (value === undefined) continue;
		// logo may be a local path served from /logos/
		if (field === 'logo' && typeof value === 'string' && value.startsWith('/logos/')) continue;
		if (!isValidHttpUrl(value)) {
			errors.push(`${label}: ${field} "${value}" is not a valid URL`);
		}
	}

	return errors;
}

/**
 * Validate an array of projects, including cross-project checks
 * (unique ids, unique repository URLs). Returns an array of error strings.
 */
export function validateAll(projects) {
	const errors = [];

	for (const project of projects) {
		errors.push(...validateProject(project));
	}

	const seenIds = new Map();
	const seenRepos = new Map();
	for (const project of projects) {
		if (project.id) {
			if (seenIds.has(project.id)) {
				errors.push(`Duplicate id "${project.id}" (also ${seenIds.get(project.id)})`);
			} else {
				seenIds.set(project.id, project.name || project.id);
			}
		}
		if (project.github) {
			const key = normalizeRepoUrl(project.github);
			if (seenRepos.has(key)) {
				errors.push(`Duplicate repository "${project.github}" in "${project.id}" and "${seenRepos.get(key)}"`);
			} else {
				seenRepos.set(key, project.id);
			}
		}
	}

	return errors;
}
