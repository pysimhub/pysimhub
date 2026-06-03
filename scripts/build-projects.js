#!/usr/bin/env node

/**
 * Generate the merged static/data/projects.json from the per-project source
 * files in static/data/projects/. Run automatically before dev/build and in
 * the data-update workflow. The merged file is git-ignored.
 */

import { buildProjectsJson } from './lib/projects-store.js';

const projects = buildProjectsJson();
console.log(`Built projects.json from ${projects.length} project files`);
