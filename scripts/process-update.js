#!/usr/bin/env node

/**
 * Process a project update from a GitHub issue.
 * Parses individual form fields, validates them, and applies changes to the project.
 * Used by the process-update GitHub Action.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadProjects, writeProject } from './lib/projects-store.js';
import { sanitizeTag } from './lib/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isValidUrl(string) {
	try {
		const url = new URL(string);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Validate a URL and return a detailed error message if invalid
 */
function validateUrl(url, fieldName) {
	if (!url) return null;

	// Check for common issues
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return `${fieldName}: "${url}" - must start with http:// or https://`;
	}

	try {
		new URL(url);
	} catch {
		return `${fieldName}: "${url}" - invalid URL format`;
	}

	return null; // Valid
}

/**
 * Extract URLs from markdown text (links and raw URLs)
 */
function extractUrlsFromMarkdown(text) {
	if (!text) return [];
	const urls = [];

	// Match markdown links: [text](url)
	const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
	let match;
	while ((match = mdLinkRegex.exec(text)) !== null) {
		urls.push({ url: match[2], context: `[${match[1]}](...)` });
	}

	// Match raw URLs (http/https) not already in markdown links
	const rawUrlRegex = /(?<!\]\()https?:\/\/[^\s<>\[\]"'`)]+/g;
	while ((match = rawUrlRegex.exec(text)) !== null) {
		urls.push({ url: match[0], context: 'raw URL' });
	}

	return urls;
}

function extractField(issueBody, label) {
	// Match "### Label\n\nvalue" or "### Label\n\nvalue\n\n### Next"
	const regex = new RegExp(`### ${label}\\s*\\n\\n([\\s\\S]*?)(?=\\n\\n###|$)`, 'i');
	const match = issueBody.match(regex);
	if (!match) return null;

	const value = match[1].trim();
	if (value === '_No response_' || value === '') return null;
	return value;
}

function extractCheckedTags(issueBody, label) {
	const regex = new RegExp(`### ${label}\\s*\\n\\n([\\s\\S]*?)(?=\\n\\n###|$)`, 'i');
	const match = issueBody.match(regex);
	if (!match) return [];

	const checkboxSection = match[1];
	const tags = [];

	// Match checked checkboxes: "- [X] tag-name" or "- [x] tag-name"
	const checkboxRegex = /- \[[xX]\] (.+)/g;
	let checkboxMatch;
	while ((checkboxMatch = checkboxRegex.exec(checkboxSection)) !== null) {
		tags.push(checkboxMatch[1].trim());
	}

	return tags;
}

function cleanUrl(url) {
	if (!url) return null;
	// Remove trailing quotes, brackets, and other invalid URL characters
	return url.replace(/["'<>\]\)]+$/, '').trim();
}

function extractLogoUrl(logoContent) {
	if (!logoContent) return null;

	// Check for markdown image
	const mdMatch = logoContent.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
	if (mdMatch) return cleanUrl(mdMatch[1]);

	// Check for GitHub user attachment (UUID format)
	const ghMatch = logoContent.match(/(https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+)/i);
	if (ghMatch) return cleanUrl(ghMatch[1]);

	// Check for direct image URL
	const urlMatch = logoContent.match(/(https?:\/\/\S+\.(png|svg|jpg|jpeg|webp|gif)(\?[^\s]*)?)/i);
	if (urlMatch) return cleanUrl(urlMatch[1]);

	return null;
}

function parseUpdate(issueBody) {
	// Extract project ID from dropdown
	const projectMatch = issueBody.match(/### Project\s*\n\n(\S+)/);
	if (!projectMatch) {
		throw new Error('Could not find project selection in issue body');
	}
	const projectId = projectMatch[1].trim();

	// Extract reason
	const reason = extractField(issueBody, 'Reason for Update') || 'No reason provided';

	// Build updates object from individual fields
	const updates = {};

	// Text fields
	const tagline = extractField(issueBody, 'Tagline');
	const description = extractField(issueBody, 'Description');
	const docs = extractField(issueBody, 'Documentation');
	const pypi = extractField(issueBody, 'PyPI');
	const condaForge = extractField(issueBody, 'Conda-Forge');
	const homepage = extractField(issueBody, 'Homepage');
	const example = extractField(issueBody, 'Example or Tutorial');

	if (tagline) updates.tagline = tagline;
	if (description) updates.description = description;
	if (docs) updates.docs = docs;
	if (pypi) updates.pypi = pypi;
	if (condaForge) updates.condaForge = condaForge;
	if (homepage) updates.homepage = homepage;
	if (example) updates.example = example;

	// Tags from checkboxes (sanitized to the allowed charset)
	const checkedTags = extractCheckedTags(issueBody, 'Select new tags');
	const customTagsRaw = extractField(issueBody, 'Additional Tags');
	const customTags = customTagsRaw ? customTagsRaw.split(',') : [];

	const allTags = [...new Set([...checkedTags, ...customTags].map(sanitizeTag).filter(Boolean))];
	if (allTags.length > 0) {
		updates.tags = allTags;
	}

	// Logo
	const logoContent = extractField(issueBody, 'Logo');
	const logoUrl = extractLogoUrl(logoContent);
	if (logoUrl) {
		updates.logo = logoUrl;
	}

	// Validate URLs with detailed feedback
	const urlFields = ['docs', 'pypi', 'condaForge', 'homepage', 'example', 'logo'];
	const urlErrors = [];

	// Validate explicit URL fields
	for (const field of urlFields) {
		const error = validateUrl(updates[field], field);
		if (error) urlErrors.push(error);
	}

	// Validate URLs in description (markdown links)
	if (updates.description) {
		const descriptionUrls = extractUrlsFromMarkdown(updates.description);
		for (const { url, context } of descriptionUrls) {
			const error = validateUrl(url, `description ${context}`);
			if (error) urlErrors.push(error);
		}
	}

	if (urlErrors.length > 0) {
		throw new Error(`Invalid URLs found:\n\n${urlErrors.join('\n')}\n\nPlease ensure all URLs start with http:// or https:// and are properly formatted.`);
	}

	if (Object.keys(updates).length === 0) {
		throw new Error('No updates provided. Please fill in at least one field to update.');
	}

	return { projectId, updates, reason };
}

function applyUpdate(projectId, updates) {
	const projects = loadProjects();

	// Find the project
	const project = projects.find(p => p.id === projectId);
	if (!project) {
		throw new Error(`Project with ID '${projectId}' not found`);
	}

	// Apply updates
	for (const [key, value] of Object.entries(updates)) {
		if (value === '' || value === null) {
			delete project[key];
		} else {
			project[key] = value;
		}
	}

	// Write back the single project file
	writeProject(project);

	return project;
}

// Main execution
const issueBody = process.env.ISSUE_BODY;
const issueAuthor = process.env.ISSUE_AUTHOR;

if (!issueBody) {
	console.error('ISSUE_BODY environment variable is required');
	process.exit(1);
}

try {
	const { projectId, updates, reason } = parseUpdate(issueBody);
	const project = applyUpdate(projectId, updates);

	// Check if updater is different from original submitter
	const isOriginalSubmitter = project.submittedBy === issueAuthor;

	// Output for GitHub Actions
	console.log(`PROJECT_ID=${projectId}`);
	console.log(`PROJECT_NAME=${project.name}`);
	console.log(`UPDATED_FIELDS=${Object.keys(updates).join(', ')}`);
	console.log(`REASON=${reason}`);
	console.log(`IS_ORIGINAL_SUBMITTER=${isOriginalSubmitter}`);

	// Write to GITHUB_OUTPUT if available
	if (process.env.GITHUB_OUTPUT) {
		const output = [
			`id=${projectId}`,
			`name=${project.name}`,
			`updated_fields=${Object.keys(updates).join(', ')}`,
			`reason=${reason}`,
			`is_original_submitter=${isOriginalSubmitter}`,
			`original_submitter=${project.submittedBy || 'unknown'}`
		].join('\n');
		writeFileSync(process.env.GITHUB_OUTPUT, output + '\n', { flag: 'a' });
	}
} catch (error) {
	console.error(`ERROR=${error.message}`);
	// Write the full (possibly multi-line) message for the workflow to post verbatim
	writeFileSync('process-error.txt', error.message);
	process.exit(1);
}
