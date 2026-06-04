#!/usr/bin/env node

/**
 * Process a project submission from a GitHub issue.
 * Parses individual form fields, validates them, and outputs the project data.
 * Used by the process-submission GitHub Action.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadProjects, writeProject } from './lib/projects-store.js';
import { sanitizeTag, normalizeRepoUrl, validateProject } from './lib/validate.js';

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

function parseSubmission(issueBody) {
	const project = {};

	// Extract basic fields
	project.name = extractField(issueBody, 'Project Name');
	project.tagline = extractField(issueBody, 'Tagline');
	project.description = extractField(issueBody, 'Description');

	// Validate required fields
	const required = ['name', 'tagline', 'description'];
	const missing = required.filter(f => !project[f]);
	if (missing.length > 0) {
		throw new Error(`Missing required fields: ${missing.join(', ')}`);
	}

	// Extract tags from checkboxes
	const checkedTags = extractCheckedTags(issueBody, 'Select all tags that apply');
	const customTagsRaw = extractField(issueBody, 'Additional Tags');
	const customTags = customTagsRaw ? customTagsRaw.split(',') : [];

	// Sanitize every tag to the allowed charset so custom tags can't corrupt
	// the generated issue templates (see sync-issue-templates.js).
	const tags = [...checkedTags, ...customTags].map(sanitizeTag).filter(Boolean);
	project.tags = [...new Set(tags)];

	if (project.tags.length === 0) {
		throw new Error('At least one tag is required');
	}

	// Extract URLs (the field still stores any repo URL; GitHub or GitLab)
	project.github = extractField(issueBody, 'Repository');
	if (!project.github) {
		throw new Error('Repository is required');
	}

	const docs = extractField(issueBody, 'Documentation');
	const pypi = extractField(issueBody, 'PyPI');
	const condaForge = extractField(issueBody, 'Conda-Forge');
	const homepage = extractField(issueBody, 'Homepage');
	const example = extractField(issueBody, 'Example or Tutorial');

	if (docs) project.docs = docs;
	if (pypi) project.pypi = pypi;
	if (condaForge) project.condaForge = condaForge;
	if (homepage) project.homepage = homepage;
	if (example) project.example = example;

	// Validate URLs with detailed feedback
	const urlFields = ['github', 'docs', 'pypi', 'condaForge', 'homepage', 'example'];
	const urlErrors = [];

	// Validate explicit URL fields
	for (const field of urlFields) {
		const error = validateUrl(project[field], field);
		if (error) urlErrors.push(error);
	}

	// Validate URLs in description (markdown links)
	if (project.description) {
		const descriptionUrls = extractUrlsFromMarkdown(project.description);
		for (const { url, context } of descriptionUrls) {
			const error = validateUrl(url, `description ${context}`);
			if (error) urlErrors.push(error);
		}
	}

	if (urlErrors.length > 0) {
		throw new Error(`Invalid URLs found:\n\n${urlErrors.join('\n')}\n\nPlease ensure all URLs start with http:// or https:// and are properly formatted.`);
	}

	// Generate ID from name
	project.id = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	if (!project.id) {
		throw new Error(`Could not derive a valid project id from the name "${project.name}". Please use a name with letters or numbers.`);
	}

	// Extract logo
	const logoContent = extractField(issueBody, 'Logo');
	const logoUrl = extractLogoUrl(logoContent);
	if (logoUrl) {
		project.logo = logoUrl;
	}

	return project;
}

function addProject(project) {
	const projects = loadProjects();

	// Check for duplicate id
	if (projects.some(p => p.id === project.id)) {
		throw new Error(`Project with ID '${project.id}' already exists`);
	}

	// Check for duplicate repository (same repo submitted under a different name)
	const repoKey = normalizeRepoUrl(project.github);
	const existingRepo = projects.find(p => normalizeRepoUrl(p.github) === repoKey);
	if (existingRepo) {
		throw new Error(`Repository ${project.github} is already listed as "${existingRepo.name}"`);
	}

	// Write the project to its own source file
	writeProject(project);
}

// Main execution
const issueBody = process.env.ISSUE_BODY;
const issueAuthor = process.env.ISSUE_AUTHOR;

if (!issueBody) {
	console.error('ISSUE_BODY environment variable is required');
	process.exit(1);
}

try {
	const project = parseSubmission(issueBody);

	// Store the submitter's GitHub handle
	if (issueAuthor) {
		project.submittedBy = issueAuthor;
	}

	// Final guard: the assembled project must satisfy the data schema
	const schemaErrors = validateProject(project);
	if (schemaErrors.length > 0) {
		throw new Error(`Invalid project data:\n\n${schemaErrors.join('\n')}`);
	}

	addProject(project);

	// Output for GitHub Actions
	console.log(`PROJECT_ID=${project.id}`);
	console.log(`PROJECT_NAME=${project.name}`);
	console.log(`PROJECT_TAGLINE=${project.tagline}`);
	console.log(`PROJECT_TAGS=${project.tags.join(', ')}`);
	console.log(`PROJECT_GITHUB=${project.github}`);

	// Write to GITHUB_OUTPUT if available
	if (process.env.GITHUB_OUTPUT) {
		const output = [
			`id=${project.id}`,
			`name=${project.name}`,
			`tagline=${project.tagline}`,
			`tags=${project.tags.join(', ')}`,
			`github=${project.github}`
		].join('\n');
		writeFileSync(process.env.GITHUB_OUTPUT, output + '\n', { flag: 'a' });
	}
} catch (error) {
	console.error(`ERROR=${error.message}`);
	// Write the full (possibly multi-line) message for the workflow to post verbatim
	writeFileSync('process-error.txt', error.message);
	process.exit(1);
}
