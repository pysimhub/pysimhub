<script lang="ts">
	import type { Project } from '$lib/types/project';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatNumber } from '$lib/utils/countup';
	import { selectedTags, resetVisible, openProjectModal } from '$lib/stores/projects';
	import { formatDate, isRecentDate } from '$lib/utils/format';
	import { getRepoLink } from '$lib/utils/repo';
	import { Icon } from '$lib/components/icons';
	import { Avatar, Badge, Tooltip } from '$lib/components/ui';

	interface Props {
		project: Project;
	}

	let { project }: Props = $props();

	function toggleTag(tag: string, e: MouseEvent) {
		e.stopPropagation();

		// If not on home page, navigate to home with this tag selected
		if ($page.url.pathname !== '/') {
			selectedTags.set([tag]);
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

	function openModal(e: MouseEvent) {
		// Don't open if clicking a link or button inside
		const target = e.target as HTMLElement;
		if (target.closest('a') || target.closest('button')) return;
		openProjectModal(project);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openProjectModal(project);
		}
	}

	const hasRecentRelease = $derived(isRecentDate(project.lastRelease, 30));

	// Repo link adapts its icon/label to the provider (GitHub or GitLab)
	const repoLink = $derived(getRepoLink(project.github));

	// All available links
	const allLinks = $derived([
		{ key: 'repo', href: project.github, icon: repoLink.icon, label: repoLink.label },
		project.docs ? { key: 'docs', href: project.docs, icon: 'docs' as const, label: 'Docs' } : null,
		project.pypi ? { key: 'pypi', href: project.pypi, icon: 'package' as const, label: 'PyPI' } : null,
		project.condaForge ? { key: 'conda', href: project.condaForge, icon: 'package' as const, label: 'conda-forge' } : null,
		project.homepage ? { key: 'home', href: project.homepage, icon: 'globe' as const, label: 'Website' } : null,
		project.example ? { key: 'example', href: project.example, icon: 'play' as const, label: 'Example' } : null,
	].filter(Boolean) as Array<{ key: string; href: string; icon: 'github' | 'gitlab' | 'docs' | 'package' | 'globe' | 'play'; label: string }>);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<article
	onclick={openModal}
	onkeydown={handleKeydown}
	class="group relative flex h-full w-full flex-col rounded-lg lg:rounded-xl bg-[var(--color-bg-card)] p-3 lg:p-5 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg {hasRecentRelease
		? 'border-2 border-[var(--color-accent)]/80 hover:border-[var(--color-accent)]'
		: 'border border-[var(--color-border)] hover:border-[var(--color-border-hover)]'}"
	role="button"
	tabindex="0"
	aria-haspopup="dialog"
>
	<!-- Logo and Name -->
	<div class="flex items-start gap-3">
		<Avatar src={project.avatarUrl} alt="{project.name} logo" fallback={project.name.slice(0, 2)} size="md" />
		<div class="min-w-0 flex-1">
			<h3 class="truncate text-lg font-semibold text-[var(--color-text-primary)]">
				{project.name}
			</h3>
			<!-- Stats Row -->
			<div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
				<span class="flex items-center gap-1">
					<Icon name="star" size="xs" class="h-3.5 w-3.5" />
					{formatNumber(project.stars)}
				</span>
				{#if project.lastRelease}
					<span class="hidden lg:flex items-center gap-1 {hasRecentRelease ? 'text-[var(--color-accent)] font-medium' : ''}">
						<Icon name="calendar" size="xs" class="h-3.5 w-3.5" />
						{formatDate(project.lastRelease, 'short')}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Tagline (hidden on compact) -->
	<p class="hidden lg:block mt-3 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
		{project.tagline}
	</p>

	<!-- Tags (hidden on compact) -->
	<div class="hidden lg:flex mt-3 flex-wrap items-start gap-1.5">
		{#each project.tags as tag}
			<Badge variant={isTagSelected(tag) ? 'active' : 'default'} size="sm" interactive class="whitespace-nowrap" onclick={(e) => toggleTag(tag, e)}>
				{tag}
			</Badge>
		{/each}
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Action Links (hidden on compact) -->
	<div class="hidden lg:flex mt-4 items-center gap-1.5">
		{#each allLinks as link (link.key)}
			<Tooltip text={link.label}>
				<a
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
				>
					<Icon name={link.icon} size="sm" />
				</a>
			</Tooltip>
		{/each}
	</div>
</article>
