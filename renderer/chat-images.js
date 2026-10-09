(function expose(root) {
  const types = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const maxBytes = 10 * 1024 * 1024;
  const maxImages = 4;

  function bindComposer({ input, picker, button, previews, onError, onChange, isBusy = () => false, canAttach = () => true }) {
    const records = [];
    const render = () => {
      previews.replaceChildren();
      previews.hidden = records.length === 0;
      for (const record of records) {
        const item = document.createElement('div');
        item.className = 'composer-image';
        const image = document.createElement('img');
        image.src = record.url;
        image.alt = record.file.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `移除图片 ${record.file.name}`);
        remove.addEventListener('click', () => {
          if (isBusy()) return;
          const index = records.indexOf(record);
          if (index >= 0) records.splice(index, 1);
          URL.revokeObjectURL(record.url);
          render();
        });
        item.append(image, remove);
        previews.appendChild(item);
      }
      onChange();
    };
    const add = (files, restoring = false) => {
      if (!canAttach()) return;
      if (isBusy() && !restoring) { onError('请等待当前回复结束后再添加图片.'); return; }
      for (const file of files) {
        if (!types.has(file.type)) { onError('图片支持 PNG、JPEG 和 WebP.'); continue; }
        if (file.size > maxBytes) { onError('单张图片不能超过 10 MB.'); continue; }
        if (records.length >= maxImages) { onError('每条消息最多添加 4 张图片.'); break; }
        records.push({ file, url: URL.createObjectURL(file) });
      }
      render();
    };
    button.addEventListener('click', () => { if (canAttach()) picker.click(); });
    picker.addEventListener('change', () => { add([...picker.files]); picker.value = ''; });
    input.addEventListener('paste', event => {
      const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
      if (!files.length || !canAttach()) return;
      event.preventDefault();
      if (input.readOnly) { onError('正在读取图片, 请稍候.'); return; }
      const text = event.clipboardData.getData('text/plain');
      if (text) input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
      add(files);
    });
    const composer = input.closest('form');
    composer.addEventListener('dragover', event => {
      if (![...event.dataTransfer.types].includes('Files')) return;
      event.preventDefault();
      if (canAttach()) composer.classList.add('is-drop-target');
    });
    composer.addEventListener('dragleave', event => {
      if (!composer.contains(event.relatedTarget)) composer.classList.remove('is-drop-target');
    });
    composer.addEventListener('drop', event => {
      if (![...event.dataTransfer.types].includes('Files')) return;
      event.preventDefault();
      composer.classList.remove('is-drop-target');
      add([...event.dataTransfer.files]);
    });
    return {
      count: () => records.length,
      files: () => records.map(record => record.file),
      previews: () => records.map(record => ({ name: record.file.name, url: URL.createObjectURL(record.file), temporary: true })),
      add,
      restore: files => add(files, true),
      clear() {
        for (const record of records) URL.revokeObjectURL(record.url);
        records.length = 0;
        render();
      },
      async payload() {
        return Promise.all(records.map(async ({ file }) => {
          let bytes;
          let mimeType = file.type;
          if (mimeType === 'image/webp') {
            const bitmap = await createImageBitmap(file);
            try {
              const canvas = document.createElement('canvas');
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              canvas.getContext('2d').drawImage(bitmap, 0, 0);
              const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
              if (!png) throw new Error('图片转换失败.');
              if (png.size > maxBytes) throw new Error('转换后的图片超过 10 MB, 请使用更小的图片.');
              bytes = await png.arrayBuffer();
              mimeType = 'image/png';
            } finally { bitmap.close(); }
          } else bytes = await file.arrayBuffer();
          return { name: file.name, mimeType, bytes };
        }));
      },
    };
  }

  function renderAttachments(body, attachments = []) {
    if (!attachments.length) return;
    const group = document.createElement('div');
    group.className = 'message-images';
    for (const attachment of attachments) {
      if (!/^(?:file:|blob:|data:image\/(?:png|jpeg);base64,)/.test(attachment.url || '')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-image';
      button.setAttribute('aria-label', `查看图片 ${attachment.name || ''}`);
      const image = document.createElement('img');
      image.src = attachment.url;
      image.alt = attachment.name || '图片附件';
      image.loading = 'lazy';
      if (attachment.temporary) image.dataset.previewUrl = attachment.url;
      if (attachment.id) button.addEventListener('click', async () => {
        const result = await root.lc.openChatImage(attachment.id);
        if (!result.ok) document.getElementById('status').textContent = result.error;
      });
      button.appendChild(image);
      group.appendChild(button);
    }
    body.prepend(group);
  }

  function releasePreviews(container) {
    for (const image of container.querySelectorAll('img[data-preview-url]')) URL.revokeObjectURL(image.dataset.previewUrl);
  }

  root.BambooChatImages = { bindComposer, renderAttachments, releasePreviews };
})(globalThis);
