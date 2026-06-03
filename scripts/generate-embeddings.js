#!/usr/bin/env node

/**
 * Generate semantic embeddings for all projects using transformers.js.
 * Uses bge-small-en-v1.5 (384-dim) for sentence embeddings.
 *
 * Incremental: only embeds new/changed projects, removes stale entries.
 * Use --force to regenerate all embeddings.
 *
 * Usage: node scripts/generate-embeddings.js [--force]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import { pipeline } from '@huggingface/transformers';
import { loadProjects } from './lib/projects-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODEL_ID = 'Xenova/bge-small-en-v1.5';
const OUTPUT_PATH = join(__dirname, '..', 'static', 'data', 'embeddings.json');

const forceAll = process.argv.includes('--force');

function buildText(project) {
	const parts = [project.name, project.tagline];
	if (project.tags?.length) parts.push(project.tags.join(', '));
	if (project.description) parts.push(project.description);
	return parts.join('. ');
}

function hashText(text) {
	return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function main() {
	const projects = loadProjects();
	const projectIds = new Set(projects.map((p) => p.id));

	// Load existing embeddings if available
	let existing = { model: MODEL_ID, dimensions: 384, hashes: {}, embeddings: {} };
	if (!forceAll && existsSync(OUTPUT_PATH)) {
		try {
			existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
		} catch {
			console.warn('Could not parse existing embeddings, regenerating all');
		}
	}

	// If model changed, force regenerate all
	const modelChanged = existing.model !== MODEL_ID;
	if (modelChanged) {
		console.log(`Model changed from ${existing.model} to ${MODEL_ID}, regenerating all`);
		existing.hashes = {};
		existing.embeddings = {};
	}

	// Determine which projects need (re)embedding
	const toEmbed = [];
	for (const project of projects) {
		const text = buildText(project);
		const hash = hashText(text);

		if (forceAll || !existing.embeddings[project.id] || existing.hashes?.[project.id] !== hash) {
			toEmbed.push({ project, text, hash });
		}
	}

	// Remove stale embeddings for deleted projects
	const staleIds = Object.keys(existing.embeddings).filter((id) => !projectIds.has(id));
	for (const id of staleIds) {
		delete existing.embeddings[id];
		if (existing.hashes) delete existing.hashes[id];
		console.log(`Removed stale embedding: ${id}`);
	}

	if (toEmbed.length === 0 && staleIds.length === 0) {
		console.log('All embeddings up to date, nothing to do');
		return;
	}

	if (toEmbed.length > 0) {
		console.log(`Loading model: ${MODEL_ID}`);
		const extractor = await pipeline('feature-extraction', MODEL_ID);
		console.log(`Generating embeddings for ${toEmbed.length}/${projects.length} projects...`);

		for (const { project, text, hash } of toEmbed) {
			const result = await extractor(text, { pooling: 'mean', normalize: true });
			existing.embeddings[project.id] = Array.from(result.data);
			if (!existing.hashes) existing.hashes = {};
			existing.hashes[project.id] = hash;
			process.stdout.write('.');
		}
		console.log();
	}

	const output = {
		model: MODEL_ID,
		dimensions: 384,
		generatedAt: new Date().toISOString(),
		hashes: existing.hashes || {},
		embeddings: existing.embeddings
	};

	writeFileSync(OUTPUT_PATH, JSON.stringify(output));
	console.log(`Wrote ${Object.keys(output.embeddings).length} embeddings to ${OUTPUT_PATH}`);
	if (toEmbed.length > 0) console.log(`  - ${toEmbed.length} new/updated`);
	if (staleIds.length > 0) console.log(`  - ${staleIds.length} removed`);
}

main().catch((err) => {
	console.error('Failed to generate embeddings:', err);
	process.exit(1);
});
