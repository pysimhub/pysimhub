/**
 * Shared constants for the project data pipeline.
 * Centralized so the process scripts, validator and link checker agree.
 */

// A project id is a lowercase slug; it also serves as the filename.
export const ID_PATTERN = /^[a-z0-9-]+$/;

// Allowed characters in a tag: lowercase letters, digits, spaces and hyphens.
export const TAG_ALLOWED = /[^a-z0-9 -]/g;

// Fields that must be present and non-empty on every project.
export const REQUIRED_FIELDS = ['id', 'name', 'tagline', 'github', 'tags'];

// The repository URL field (named `github` for historical reasons; holds any repo URL).
export const REPO_FIELD = 'github';

// Optional fields that, when present, must be valid URLs (logo may also be a local /logos/ path).
export const OPTIONAL_URL_FIELDS = ['docs', 'pypi', 'condaForge', 'homepage', 'example', 'logo'];

// Every URL-bearing field (used by the link checker and validator).
export const ALL_URL_FIELDS = [REPO_FIELD, ...OPTIONAL_URL_FIELDS];
