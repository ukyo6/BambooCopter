(function expose(root) {
  const escape = text => String(text || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const parser = new root.marked.Marked({
    gfm: true,
    breaks: true,
    extensions: [{
      name: 'quotedStrong',
      level: 'inline',
      start: source => source.indexOf('**'),
      tokenizer(source) {
        // 兼容紧贴中文正文的引号加粗, 例如 表示**“最远下标”**.
        const match = /^\*\*((?:“[^\n]+?”|「[^\n]+?」|『[^\n]+?』|"(?:\\.|[^"\\\n])+"))\*\*/.exec(source);
        if (match) return { type: 'strong', raw: match[0], text: match[1], tokens: this.lexer.inlineTokens(match[1]) };
      },
    }],
    renderer: {
      html: token => escape(token.text),
      image: token => `<a href="${escape(token.href)}">${escape(token.text || '图片')}</a>`,
    },
  });

  function render(body, text) {
    const fragment = root.DOMPurify.sanitize(parser.parse(String(text || '')), {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'],
      ALLOWED_ATTR: ['href', 'title', 'class', 'start', 'align'],
    });
    for (const link of fragment.querySelectorAll('a')) {
      try {
        const url = new URL(link.getAttribute('href'));
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported link');
        link.setAttribute('href', url.href);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.addEventListener('click', async event => {
          if (!root.lc?.openExternalLink) return;
          event.preventDefault();
          const result = await root.lc.openExternalLink(url.href);
          if (!result.ok) body.ownerDocument.getElementById('status').textContent = result.error;
        });
      } catch {
        link.removeAttribute('href');
      }
    }
    for (const table of fragment.querySelectorAll('table')) {
      const wrapper = body.ownerDocument.createElement('div');
      wrapper.className = 'chat-table-scroll';
      table.replaceWith(wrapper);
      wrapper.appendChild(table);
    }
    body.classList.add('is-markdown');
    body.replaceChildren(fragment);
  }

  root.BambooChatMarkdown = { render };
})(globalThis);
