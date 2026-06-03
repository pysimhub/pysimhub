/**
 * Shared store for project data.
 *
 * Source of truth is one JSON file per project under static/data/projects/.
 * The merged static/data/projects.json (consumed by the frontend) is a
 * generated artifact, produced by buildProjectsJson() and git-ignored.
 *
 * Keeping each project in its own file means concurrent submissions/updates
 * never touch the same file, so they merge cleanly instead of conflicting.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..', '..');
export const PROJECTS_DIR = join(ROOT, 'static', 'data', 'projects');
export const PROJECTS_JSON = join(ROOT, 'static', 'data', 'projects.json');

function ensureDir() {
	if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
}

/** Absolute path of a project's source file. */
export function projectFilePath(id) {
	return join(PROJECTS_DIR, `${id}.json`);
}

/**
 * Load all projects from the per-project files, sorted by id for determinism.
 */
export function loadProjects() {
	ensureDir();
	const files = readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
	const projects = files.map((f) => JSON.parse(readFileSync(join(PROJECTS_DIR, f), 'utf-8')));
	projects.sort((a, b) => a.id.localeCompare(b.id));
	return projects;
}

/** Write a single project to its own file (pretty, tab-indented). */
export function writeProject(project) {
	ensureDir();
	writeFileSync(projectFilePath(project.id), JSON.stringify(project, null, '\t') + '\n');
}

/** Delete a project's source file. Returns true if a file was removed. */
export function deleteProjectFile(id) {
	const path = projectFilePath(id);
	if (existsSync(path)) {
		unlinkSync(path);
		return true;
	}
	return false;
}

/**
 * Regenerate the merged static/data/projects.json from the per-project files.
 * This is the file the frontend fetches.
 */
export function buildProjectsJson() {
	const projects = loadProjects();
	writeFileSync(PROJECTS_JSON, JSON.stringify(projects, null, '\t') + '\n');
	return projects;
}
