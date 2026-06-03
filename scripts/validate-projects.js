#!/usr/bin/env node

/**
 * Validate all project data files. Run in CI on PRs that touch project data,
 * and locally before relying on the catalog. Exits non-zero on any problem,
 * so malformed data is caught before it reaches the site.
 */

import { readdirSync, readFileSync } from 'fs';
import { basename, extname } from 'path';
import { loadProjects, PROJECTS_DIR, projectFilePath } from './lib/projects-store.js';
import { validateAll } from './lib/validate.js';

const errors = [];

// Each file's name must match the project's id (so the slug stays the filename).
for (const file of readdirSync(PROJECTS_DIR).filter((f) => extname(f) === '.json')) {
	const id = basename(file, '.json');
	const path = projectFilePath(id);
	let project;
	try {
		project = JSON.parse(readFileSync(path, 'utf-8'));
	} catch (e) {
		errors.push(`${file}: invalid JSON (${e.message})`);
		continue;
	}
	if (project.id !== id) {
		errors.push(`${file}: id "${project.id}" does not match filename`);
	}
}

errors.push(...validateAll(loadProjects()));

if (errors.length > 0) {
	console.error(`✗ Project validation failed with ${errors.length} error(s):\n`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

console.log('✓ All project files are valid');
