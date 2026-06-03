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

function isHttpUrl(url) {
	return typeof url === 'string' && /^https?:\/\//.test(url);
}

/**
 * Extract genuinely broken external links from lychee's JSON report.
 * lychee groups failures per source file under `error_map` (older versions:
 * `fail_map`). We keep only http(s) URLs, dropping lychee's noise from
 * unresolved local/root-relative paths (e.g. "/logos/x.png"), which it cannot
 * resolve on the filesystem but which work fine on the deployed site.
 */
function parseLycheeOutput(lycheeOutputPath) {
	const content = readFileSync(lycheeOutputPath, 'utf-8');

	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch {
		// NDJSON fallback (one JSON object per line)
		const lines = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
		return dedupeByUrl(lines.filter(e => isHttpUrl(e.url)));
	}

	const map = parsed.error_map || parsed.fail_map || {};
	const broken = [];
	for (const [source, entries] of Object.entries(map)) {
		for (const entry of entries) {
			if (!isHttpUrl(entry.url)) continue; // skip unresolved local/relative paths
			const status = (entry.status && typeof entry.status === 'object')
				? (entry.status.code || entry.status.text || 'error')
				: (entry.status || 'error');
			broken.push({ url: entry.url, status, source });
		}
	}
	return dedupeByUrl(broken);
}

function dedupeByUrl(links) {
	const seen = new Set();
	return links.filter(link => {
		if (seen.has(link.url)) return false;
		seen.add(link.url);
		return true;
	});
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

/** Report the broken-link count to the workflow so it can gate later steps. */
function setOutput(hasBroken, count) {
	if (process.env.GITHUB_OUTPUT) {
		writeFileSync(process.env.GITHUB_OUTPUT, `has_broken=${hasBroken}\ncount=${count}\n`, { flag: 'a' });
	}
}

try {
	const projects = loadProjects();
	const brokenLinks = parseLycheeOutput(lycheeOutputPath);

	if (brokenLinks.length === 0) {
		console.log('No broken external links found.');
		setOutput(false, 0);
		process.exit(0);
	}

	console.log(`Found ${brokenLinks.length} broken external link(s).`);
	const issueBody = generateIssueBody(brokenLinks, projects, workflowUrl);

	// Output to file if requested, otherwise print
	if (process.env.ISSUE_BODY_FILE) {
		writeFileSync(process.env.ISSUE_BODY_FILE, issueBody);
		console.log(`Issue body written to ${process.env.ISSUE_BODY_FILE}`);
	} else {
		console.log(issueBody);
	}

	setOutput(true, brokenLinks.length);
} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}
