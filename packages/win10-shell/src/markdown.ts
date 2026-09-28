// Tiny Markdown renderer (pure DOM, no dependency).
// Deliberately small: `#`, `##`, `###` headings, **bold**, *italic*,
// `code`, [text](url), "- " lists, "---" (hr), paragraphs.

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(src: string): string {
	// Escape first, then re-introduce generated tags.
	let out = escapeHtml(src);
	// `code`
	out = out.replace(/`([^`]+)`/g, `<code class="w10-md-code">$1</code>`);
	// [text](url)
	out = out.replace(
		/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
		`<a class="w10-md-link" href="$2" target="_blank" rel="noreferrer noopener">$1</a>`,
	);
	// **bold** (before *italic*)
	out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	// *italic*
	out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
	return out;
}

/** Render mini-markdown to a DOM element (links open in a new tab). */
export function renderMarkdown(md: string): HTMLElement {
	const root = document.createElement("div");
	root.className = "w10-md";
	const lines = md.replace(/\r\n/g, "\n").split("\n");
	let list: HTMLUListElement | null = null;

	const flushList = () => {
		list = null;
	};

	for (const raw of lines) {
		const line = raw.trim();
		if (line === "") {
			flushList();
			continue;
		}
		if (line === "---") {
			flushList();
			const hr = document.createElement("hr");
			hr.className = "w10-md-hr";
			root.appendChild(hr);
			continue;
		}
		const h3 = line.match(/^###\s+(.*)$/);
		const h2 = line.match(/^##\s+(.*)$/);
		const h1 = line.match(/^#\s+(.*)$/);
		if (h3 || h2 || h1) {
			flushList();
			const m = (h3 ?? h2 ?? h1)!;
			const el = document.createElement(h3 ? "h3" : h2 ? "h2" : "h1");
			el.className = "w10-md-title";
			el.innerHTML = renderInline(m[1]);
			root.appendChild(el);
			continue;
		}
		const li = line.match(/^[-*]\s+(.*)$/);
		if (li) {
			if (!list) {
				list = document.createElement("ul");
				list.className = "w10-md-list";
				root.appendChild(list);
			}
			const item = document.createElement("li");
			item.innerHTML = renderInline(li[1]);
			list.appendChild(item);
			continue;
		}
		flushList();
		const p = document.createElement("p");
		p.className = "w10-md-p";
		p.innerHTML = renderInline(raw.trim());
		root.appendChild(p);
	}
	return root;
}
