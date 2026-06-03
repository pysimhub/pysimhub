<script lang="ts">
	import type { Project } from '$lib/types/project';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatNumber } from '$lib/utils/countup';
	import { selectedTags, resetVisible, openProjectModal } from '$lib/stores/projects';
	import { formatDate } from '$lib/utils/format';
	import { getRepoLink } from '$lib/utils/repo';
	import { fade, scale } from 'svelte/transition';
	import { Icon } from '$lib/components/icons';
	import { Avatar, Badge, Tooltip } from '$lib/components/ui';
	import { marked } from 'marked';

	interface Props {
		project: Project;
		onclose: () => void;
	}

	let { project, onclose }: Props = $props();

	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	const descriptionHtml = $derived(project.description ? marked.parse(project.description) : '');

	// Repo link adapts its icon/label to the provider (GitHub or GitLab)
	const repoLink = $derived(getRepoLink(project.github));

	function toggleTag(tag: string) {
		// If not on home page, navigate to home with this tag and keep modal open
		if ($page.url.pathname !== '/') {
			selectedTags.set([tag]);
			openProjectModal(project);
			goto('/');
			return;
		}

		selectedTags.update((tags) => {
			if (tags.includes(tag)) {
				return tags.filter((t) => t !== tag);
			}
			return [...tags, tag];
		});
		resetVisible();
	}

	function isTagSelected(tag: string): boolean {
		return $selectedTags.includes(tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
	transition:fade={{ duration: 200 }}
>
	<button
		type="button"
		class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default border-none"
		onclick={onclose}
		aria-label="Close modal"
	></button>

	<!-- Modal -->
	<div
		class="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl overflow-hidden"
		transition:scale={{ duration: 200, start: 0.95 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Header -->
		<div class="flex-shrink-0 flex items-start gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
			<Avatar src={project.avatarUrl} alt="{project.name} logo" fallback={project.name.slice(0, 2)} size="lg" />

			<div class="min-w-0 flex-1">
				<h2 id="modal-title" class="text-2xl font-bold text-[var(--color-text-primary)]">
					{project.name}
				</h2>
				<!-- Stats Row - below name like card, but with more stats -->
				<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-muted)]">
					<span class="flex items-center gap-1">
						<Icon name="star" size="sm" />
						{formatNumber(project.stars)}
					</span>
					{#if project.forks}
						<span class="flex items-center gap-1">
							<Icon name="fork" size="sm" />
							{formatNumber(project.forks)}
						</span>
					{/if}
					{#if project.releaseVersion}
						<span class="flex items-center gap-1">
							<Icon name="tag" size="sm" />
							{project.releaseVersion}
						</span>
					{/if}
					{#if project.lastRelease}
						<span class="flex items-center gap-1">
							<Icon name="calendar" size="sm" />
							{formatDate(project.lastRelease)}
						</span>
					{/if}
					{#if project.license}
						<span class="flex items-center gap-1">
							<Icon name="shield" size="sm" />
							{project.license}
						</span>
					{/if}
				</div>
			</div>

			<div class="flex-shrink-0 flex items-center gap-1">
				<Tooltip text="Open project page" position="left">
					<a
						href="/projects/{project.id}"
						class="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
					>
						<Icon name="arrow-right" size="lg" class="-rotate-45" />
					</a>
				</Tooltip>
				<Tooltip text="Close" position="left">
					<button
						onclick={onclose}
						class="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
						aria-label="Close modal"
					>
						<Icon name="close" size="lg" />
					</button>
				</Tooltip>
			</div>
		</div>

		<!-- Content -->
		<div class="overflow-y-auto p-6 space-y-6">
			<!-- Tagline -->
			<p class="text-[var(--color-text-secondary)]">
				{project.tagline}
			</p>

			<!-- About Section -->
			{#if project.description}
				<div>
					<h3 class="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">About</h3>
					<div class="mt-4 prose prose-sm text-[var(--color-text-secondary)]">
						{@html descriptionHtml}
					</div>
				</div>
			{/if}

			<!-- Tags -->
			<div>
				<h3 class="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Tags</h3>
				<div class="mt-4 flex flex-wrap gap-2">
					{#each project.tags as tag}
						<Badge variant={isTagSelected(tag) ? 'active' : 'default'} size="md" interactive onclick={() => toggleTag(tag)}>
							{tag}
						</Badge>
					{/each}
				</div>
			</div>

			<!-- Links -->
			<div>
				<h3 class="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Links</h3>
				<div class="mt-4 flex flex-wrap gap-1.5">
					<a
						href={project.github}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
					>
						<Icon name={repoLink.icon} size="sm" />
						{repoLink.label}
					</a>

					{#if project.docs}
						<a
							href={project.docs}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
						>
							<Icon name="docs" size="sm" />
							Docs
						</a>
					{/if}

					{#if project.pypi}
						<a
							href={project.pypi}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
						>
							<Icon name="package" size="sm" />
							PyPI
						</a>
					{/if}

					{#if project.condaForge}
						<a
							href={project.condaForge}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
						>
							<Icon name="package" size="sm" />
							conda-forge
						</a>
					{/if}

					{#if project.homepage}
						<a
							href={project.homepage}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
						>
							<Icon name="globe" size="sm" />
							Website
						</a>
					{/if}

					{#if project.example}
						<a
							href={project.example}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
						>
							<Icon name="play" size="sm" />
							Example
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
