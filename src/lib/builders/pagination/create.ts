import {
	addEventListener,
	builder,
	createElHelpers,
	executeCallbacks,
	isHTMLElement,
	kbd,
	omit,
} from '$lib/internal/helpers';
import type { Defaults } from '$lib/internal/types';
import { derived, get, writable } from 'svelte/store';
import { getPageItems } from './helpers';
import type { CreatePaginationProps, Page } from './types';

const defaults = {
	perPage: 1,
	siblingCount: 1,
	page: 1,
} satisfies Defaults<CreatePaginationProps>;

type PaginationParts = 'page' | 'prev' | 'next';
const { name, selector } = createElHelpers<PaginationParts>('pagination');

export function createPagination(props: CreatePaginationProps) {
	const withDefaults = { ...defaults, ...props };
	const options = writable(omit(withDefaults, 'page'));
	const page = writable(withDefaults.page);

	const totalPages = derived([options], ([$options]) => {
		return Math.ceil($options.count / $options.perPage);
	});

	const range = derived([page, options], ([$page, $options]) => {
		const start = ($page - 1) * $options.perPage;
		const end = Math.min(start + $options.perPage, $options.count);
		return { start, end };
	});

	const root = builder(name(), {
		returned: () => ({
			'data-scope': 'pagination',
		}),
	});

	const pages = derived([page, totalPages, options], ([$page, $totalPages, { siblingCount }]) => {
		return getPageItems({ page: $page, totalPages: $totalPages, siblingCount });
	});

	const keydown = (e: KeyboardEvent) => {
		const thisEl = e.target;
		if (!isHTMLElement(thisEl)) return;

		const rootEl = thisEl.closest('[data-scope="pagination"]');
		if (!isHTMLElement(rootEl)) return;

		const triggers = Array.from(rootEl.querySelectorAll(selector('page'))).filter(
			(el): el is HTMLElement => isHTMLElement(el)
		);
		const prevButton = rootEl.querySelector(selector('prev'));
		const nextButton = rootEl.querySelector(selector('next'));

		if (isHTMLElement(prevButton)) {
			triggers.unshift(prevButton);
		}
		if (isHTMLElement(nextButton)) {
			triggers.push(nextButton);
		}
		const index = triggers.indexOf(thisEl);

		if (e.key === kbd.ARROW_LEFT && index !== 0) {
			e.preventDefault();
			triggers[index - 1].focus();
		} else if (e.key === kbd.ARROW_RIGHT && index !== triggers.length - 1) {
			e.preventDefault();
			triggers[index + 1].focus();
		} else if (e.key === kbd.HOME) {
			e.preventDefault();
			triggers[0].focus();
		} else if (e.key === kbd.END) {
			e.preventDefault();
			triggers[triggers.length - 1].focus();
		}
	};

	const pageTrigger = builder(name('page'), {
		stores: page,
		returned: ($page) => {
			return (pageItem: Page) => {
				return {
					'aria-label': `Page ${pageItem.value}`,
					'data-value': pageItem.value,
					'data-selected': pageItem.value === $page ? '' : undefined,
				};
			};
		},
		action: (node: HTMLElement) => {
			const unsub = executeCallbacks(
				addEventListener(node, 'click', () => {
					const value = node.dataset.value;
					if (!value || Number.isNaN(+value)) return;
					page.set(Number(value));
				}),
				addEventListener(node, 'keydown', keydown)
			);

			return {
				destroy: unsub,
			};
		},
	});

	const prevButton = builder(name('prev'), {
		stores: page,
		returned: ($page) => {
			return {
				'aria-label': 'Previous',
				disabled: $page <= 1,
			} as const;
		},
		action: (node: HTMLElement) => {
			const unsub = executeCallbacks(
				addEventListener(node, 'click', () => {
					page.update((p) => Math.max(p - 1, 1));
				}),
				addEventListener(node, 'keydown', keydown)
			);

			return {
				destroy: unsub,
			};
		},
	});

	const nextButton = builder(name('next'), {
		stores: [page, totalPages],
		returned: ([$page, $totalPages]) => {
			return {
				'aria-label': 'Next',
				disabled: $page >= $totalPages,
			} as const;
		},
		action: (node: HTMLElement) => {
			const unsub = executeCallbacks(
				addEventListener(node, 'click', () => {
					const $totalPages = get(totalPages);
					page.update((p) => Math.min(p + 1, $totalPages));
				}),
				addEventListener(node, 'keydown', keydown)
			);

			return {
				destroy: unsub,
			};
		},
	});

	return {
		options,
		page,
		pages,
		range,
		totalPages,
		root,
		pageTrigger,
		prevButton,
		nextButton,
	};
}
