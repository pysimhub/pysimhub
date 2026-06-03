#!/usr/bin/env node

/**
 * Script to sync data from projects.json to issue templates.
 * - Syncs tags (as checkboxes) to submission and update templates
 * - Syncs project IDs (as dropdown) to update and removal templates
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadProjects } from './lib/projects-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getUniqueTags(projects) {
	const tagsSet = new Set();
	for (const project of projects) {
		if (project.tags) {
			project.tags.forEach(tag => tagsSet.add(tag));
		}
	}
	return Array.from(tagsSet).sort();
}

function syncTagCheckboxes(templatePath, tags) {
	if (!existsSync(templatePath)) {
		return false;
	}

	let template = readFileSync(templatePath, 'utf-8');

	// Build checkbox options YAML
	const checkboxOptions = tags.map(tag => `        - label: "${tag}"`).join('\n');

	// Replace the options under "id: tags" checkbox section
	template = template.replace(
		/(id: tags\n[\s\S]*?options:\n)([\s\S]*?)(\n\n  - type:)/,
		`$1${checkboxOptions}$3`
	);

	writeFileSync(templatePath, template);
	return true;
}

function syncSubmissionTemplate(tags) {
	const templatePath = join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', 'project_submission.yml');

	if (syncTagCheckboxes(templatePath, tags)) {
		console.log(`Updated project_submission.yml with ${tags.length} tag checkboxes`);
	} else {
		console.log('Skipping: project_submission.yml not found');
	}
}

function syncUpdateTemplate(projects, tags) {
	const templatePath = join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', 'project_update.yml');

	if (!existsSync(templatePath)) {
		console.log('Skipping: project_update.yml not found');
		return;
	}

	let template = readFileSync(templatePath, 'utf-8');

	// Sync project IDs dropdown
	const projectIds = projects.map(p => p.id).sort();
	const dropdownOptions = projectIds.map(id => `        - ${id}`).join('\n');

	template = template.replace(
		/(id: project_id\n[\s\S]*?options:\n)([\s\S]*?)(\n\s+validations:)/,
		`$1${dropdownOptions}$3`
	);

	// Sync tag checkboxes
	const checkboxOptions = tags.map(tag => `        - label: "${tag}"`).join('\n');

	template = template.replace(
		/(id: tags\n[\s\S]*?options:\n)([\s\S]*?)(\n\n  - type:)/,
		`$1${checkboxOptions}$3`
	);

	writeFileSync(templatePath, template);
	console.log(`Updated project_update.yml with ${projectIds.length} projects and ${tags.length} tag checkboxes`);
}

function syncRemovalTemplate(projects) {
	const templatePath = join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', 'project_removal.yml');

	if (!existsSync(templatePath)) {
		console.log('Skipping: project_removal.yml not found');
		return;
	}

	let template = readFileSync(templatePath, 'utf-8');

	// Sync project IDs dropdown
	const projectIds = projects.map(p => p.id).sort();
	const dropdownOptions = projectIds.map(id => `        - ${id}`).join('\n');

	template = template.replace(
		/(id: project_id\n[\s\S]*?options:\n)([\s\S]*?)(\n\s+validations:)/,
		`$1${dropdownOptions}$3`
	);

	writeFileSync(templatePath, template);
	console.log(`Updated project_removal.yml with ${projectIds.length} projects`);
}

function main() {
	const projects = loadProjects();
	const tags = getUniqueTags(projects);

	console.log(`Found ${tags.length} unique tags: ${tags.join(', ')}`);
	console.log(`Found ${projects.length} projects`);

	syncSubmissionTemplate(tags);
	syncUpdateTemplate(projects, tags);
	syncRemovalTemplate(projects);

	console.log('Issue templates sync complete');
}

main();
