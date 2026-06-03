#!/usr/bin/env node

/**
 * Map broken links from lychee output to project submitters.
 * Reads lychee JSON output and projects.json to create an issue body
 * that @mentions the relevant submitters for each broken link.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadProjects } from './lib/projects-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL fields in projects.json that we should check
const URL_FIELDS = ['github', 'docs', 'pypi', 'condaForge', 'homepage', 'example', 'logo'];

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
		urls.push(match[2]);
	}

	// Match raw URLs (http/https)
	const rawUrlRegex = /(?<!\]\()https?:\/\/[^\s<>\[\]"'`)]+/g;
	while ((match = rawUrlRegex.exec(text)) !== null) {
		urls.push(match[0]);
	}

	return [...new Set(urls)]; // dedupe
}

function parseLycheeOutput(lycheeOutputPath) {
	const content = readFileSync(lycheeOutputPath, 'utf-8');

	// Handle both JSON array format and NDJSON (newline-delimited JSON)
	try {
		const parsed = JSON.parse(content);
		// If it's the detailed JSON format with fail_map
		if (parsed.fail_map) {
			const brokenUrls = [];
			for (const [source, failures] of Object.entries(parsed.fail_map)) {
				for (const failure of failures) {
					brokenUrls.push({
						url: failure.url,
						status: failure.status?.code || failure.status || 'unknown',
						source
					});
				}
			}
			return brokenUrls;
		}
		// Simple array format
		return parsed;
	} catch {
		// Try NDJSON format (one JSON object per line)
		const lines = content.trim().split('\n').filter(Boolean);
		return lines.map(line => JSON.parse(line));
	}
}

function findProjectForUrl(url, projects) {
	for (const project of projects) {
		// Check explicit URL fields
		for (const field of URL_FIELDS) {
			if (project[field] && project[field] === url) {
				return { project, field };
			}
			// Also check if the broken URL starts with a project URL (for subpages)
			if (project[field] && url.startsWith(project[field])) {
				return { project, field };
			}
		}

		// Check URLs in description (markdown links)
		if (project.description) {
			const descriptionUrls = extractUrlsFromMarkdown(project.description);
			for (const descUrl of descriptionUrls) {
				if (descUrl === url || url.startsWith(descUrl)) {
					return { project, field: 'description' };
				}
			}
		}
	}
	return null;
}

function generateIssueBody(brokenLinks, projects, workflowUrl) {
	// Map broken URLs to projects and group by submitter
	const bySubmitter = new Map();
	const unknownSubmitter = [];
	const unmappedLinks = [];

	for (const link of brokenLinks) {
		const match = findProjectForUrl(link.url, projects);

		if (!match) {
			unmappedLinks.push(link);
			continue;
		}

		const { project, field } = match;
		const entry = {
			project: project.name,
			projectId: project.id,
			url: link.url,
			field,
			status: link.status
		};

		if (project.submittedBy) {
			const submitter = project.submittedBy;
			if (!bySubmitter.has(submitter)) {
				bySubmitter.set(submitter, []);
			}
			bySubmitter.get(submitter).push(entry);
		} else {
			unknownSubmitter.push(entry);
		}
	}

	// Build the issue body
	let body = `# Broken Links Detected\n\n`;
	body += `The scheduled link check found broken links in project data.\n\n`;
	body += `**To fix a broken link:** Use the [Project Update form](../../issues/new?template=project_update.yml) to submit corrected URLs.\n\n`;
	body += `See the [workflow run](${workflowUrl}) for full details.\n\n`;

	// Group by submitter with @mentions
	if (bySubmitter.size > 0) {
		body += `## By Submitter\n\n`;
		for (const [submitter, links] of bySubmitter) {
			body += `### @${submitter}\n\n`;
			for (const link of links) {
				body += `- **${link.project}** (\`${link.field}\`): ${link.url}`;
				if (link.status && link.status !== 'unknown') {
					body += ` → ${link.status}`;
				}
				body += `\n`;
			}
			body += `\n`;
		}
	}

	// Projects without submitter info
	if (unknownSubmitter.length > 0) {
		body += `## Projects Without Submitter Info\n\n`;
		for (const link of unknownSubmitter) {
			body += `- **${link.project}** (\`${link.field}\`): ${link.url}`;
			if (link.status && link.status !== 'unknown') {
				body += ` → ${link.status}`;
			}
			body += `\n`;
		}
		body += `\n`;
	}

	// Links not mapped to any project
	if (unmappedLinks.length > 0) {
		body += `## Other Broken Links\n\n`;
		body += `These links were not found in any project entry:\n\n`;
		for (const link of unmappedLinks) {
			body += `- ${link.url}`;
			if (link.status && link.status !== 'unknown') {
				body += ` → ${link.status}`;
			}
			if (link.source) {
				body += ` (in \`${link.source}\`)`;
			}
			body += `\n`;
		}
	}

	return body;
}

// Main execution
const lycheeOutputPath = process.env.LYCHEE_OUTPUT || process.argv[2];
const workflowUrl = process.env.WORKFLOW_URL || 'https://github.com';

if (!lycheeOutputPath) {
	console.error('Usage: node map-broken-links.js <lychee-output.json>');
	console.error('Or set LYCHEE_OUTPUT environment variable');
	process.exit(1);
}

try {
	const projects = loadProjects();
	const brokenLinks = parseLycheeOutput(lycheeOutputPath);

	if (brokenLinks.length === 0) {
		console.log('No broken links found.');
		process.exit(0);
	}

	const issueBody = generateIssueBody(brokenLinks, projects, workflowUrl);

	// Output to file if GITHUB_OUTPUT is set, otherwise print
	if (process.env.ISSUE_BODY_FILE) {
		writeFileSync(process.env.ISSUE_BODY_FILE, issueBody);
		console.log(`Issue body written to ${process.env.ISSUE_BODY_FILE}`);
	} else {
		console.log(issueBody);
	}
} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}
