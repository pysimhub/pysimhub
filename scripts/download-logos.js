#!/usr/bin/env node

/**
 * Download external logos and save them locally.
 * Updates projects.json with local paths.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadProjects, writeProject } from './lib/projects-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
	const logosDir = join(__dirname, '..', 'static', 'logos');
	const projects = loadProjects();

	let updated = false;

	for (const project of projects) {
		// Skip if no logo or already local
		if (!project.logo || project.logo.startsWith('/logos/')) {
			continue;
		}

		// Check if it's an external URL
		if (project.logo.startsWith('http')) {
			console.log(`Downloading logo for ${project.name}: ${project.logo}`);

			try {
				const response = await fetch(project.logo);
				if (!response.ok) {
					console.log(`  Failed to fetch: ${response.status}`);
					continue;
				}

				// Determine extension from Content-Type
				const contentType = response.headers.get('content-type');
				const typeMap = {
					'image/png': 'png',
					'image/svg+xml': 'svg',
					'image/jpeg': 'jpg',
					'image/webp': 'webp',
					'image/gif': 'gif'
				};
				const ext = typeMap[contentType] || 'png';

				const filename = `${project.id}.${ext}`;
				const filepath = join(logosDir, filename);

				const buffer = Buffer.from(await response.arrayBuffer());
				writeFileSync(filepath, buffer);

				project.logo = `/logos/${filename}`;
				writeProject(project);
				updated = true;
				console.log(`  Saved to ${filepath}`);
			} catch (e) {
				console.log(`  Error: ${e.message}`);
			}
		}
	}

	if (updated) {
		console.log('Updated project files with local logo paths');
	} else {
		console.log('No logos to download');
	}
}

main().catch(console.error);
