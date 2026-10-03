(() => {
  const ROOT_SELECTOR = '.outer_page_container';
  const PAGE_SELECTOR = '.outer_page[id^="outer_page_"]';
  const STATE_KEY = '__scribdNativePrinterStateV1';
  const PRINT_STYLE_ID = 'scribd-native-printer-style';
  // Chrome làm tròn khổ giấy xuống (vd 1204px -> 1203.84px). Khổ @page luôn lớn hơn
  // phần tử trang vài px để phần tử không tràn và sinh trang trắng.
  const PAGE_PAD = 4;

  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const pagesIn = root => Array.from(root.querySelectorAll(PAGE_SELECTOR))
    .map(el => ({ el, index: Number((el.id.match(/^outer_page_(\d+)$/) || [])[1]) }))
    .filter(item => Number.isFinite(item.index))
    .sort((a, b) => a.index - b.index);

  function findViewer() {
    const roots = Array.from(document.querySelectorAll(ROOT_SELECTOR));
    return roots.map(root => ({ root, pages: pagesIn(root) }))
      .filter(item => item.pages.length)
      .sort((a, b) => b.pages.length - a.pages.length)[0] || null;
  }

  function pageSize(page) {
    const parse = value => {
      const n = Number.parseFloat(value || '');
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const computed = getComputedStyle(page);
    let width = parse(page.style.width) || parse(computed.width) || page.offsetWidth;
    let height = parse(page.style.height) || parse(computed.height) || page.offsetHeight;
    if (!width || !height) {
      const inner = page.querySelector('.newpage');
      if (inner) {
        const scaleMatch = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
        const scale = scaleMatch ? parse(scaleMatch[1]) : 1;
        width ||= parse(inner.style.width) * scale;
        height ||= parse(inner.style.height) * scale;
      }
    }
    return { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
  }

  // ---- Ghi nhớ trạng thái gốc để restore() hoàn nguyên ----

  function addClass(state, element, className) {
    if (!element) return;
    if (!state.classSnapshots.has(element)) state.classSnapshots.set(element, element.getAttribute('class'));
    element.classList.add(className);
    if (!state.addedClasses.has(element)) state.addedClasses.set(element, new Set());
    state.addedClasses.get(element).add(className);
  }

  function snapshotAttr(state, element, name) {
    if (!state.attrSnapshots.has(element)) state.attrSnapshots.set(element, new Map());
    const attrs = state.attrSnapshots.get(element);
    if (!attrs.has(name)) attrs.set(name, element.getAttribute(name));
  }

  function neutralizeBreaks(state, element) {
    snapshotAttr(state, element, 'style');
    for (const property of ['break-before', 'page-break-before', 'break-after', 'page-break-after']) {
      element.style.setProperty(property, 'auto', 'important');
    }
  }

  // ---- Nạp các trang để Scribd render đầy đủ ----

  async function waitForPage(page, timeoutMs = 700) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = page.querySelector('.text_layer')?.textContent?.trim();
      const images = Array.from(page.querySelectorAll('.image_layer img'));
      if (text || images.some(img => img.complete && img.naturalWidth > 0) || page.querySelector('.image_layer canvas')) return;
      await pause(100);
    }
  }

  async function hydrate(viewer, state, speedFactor = 1) {
    const { scrollX, scrollY } = window;
    state.scroll = { x: scrollX, y: scrollY };
    const hydrationStyle = document.createElement('style');
    hydrationStyle.textContent = '.snp-hydrate-page{display:block!important;visibility:visible!important;opacity:1!important}';
    document.head.appendChild(hydrationStyle);
    state.hydrationStyle = hydrationStyle;
    for (const { el: page } of viewer.pages) {
      // Đưa từng trang vào khung nhìn để Scribd render theo cách thông thường.
      addClass(state, page, 'snp-hydrate-page');
      page.scrollIntoView({ block: 'center', behavior: 'instant' });
      for (const img of page.querySelectorAll('.image_layer img')) {
        if (img.loading === 'lazy') img.loading = 'eager';
      }
      await waitForPage(page);
      await pause(Math.round(80 * speedFactor));
    }
    for (const img of viewer.root.querySelectorAll('.outer_page .image_layer img')) {
      if (img.loading === 'lazy') img.loading = 'eager';
    }
    await Promise.race([document.fonts?.ready || Promise.resolve(), pause(2500)]);
    await pause(250);
    window.scrollTo(scrollX, scrollY);
    hydrationStyle.remove();
  }

  // ---- Chế độ in ----

  // Chuyển container chứa các trang ra làm con trực tiếp của <body> và ẩn mọi thứ còn lại
  // của site (thanh công cụ sticky, khung cuộn, quảng cáo, ...). restore() trả về vị trí cũ.
  function isolateContainer(state, root) {
    const moved = root.closest('.document_container') || root;
    state.moved = { node: moved, parent: moved.parentNode, next: moved.nextSibling };
    addClass(state, moved, 'snp-printwrap');
    neutralizeBreaks(state, moved);
    for (const child of moved.children) {
      if (child !== root && !child.contains(root)) addClass(state, child, 'snp-hide');
    }
    document.body.appendChild(moved);

    // Một số phần tử ở cấp <body> (vd iframe theo dõi) có sẵn style inline
    // "display:block !important" nên thắng mọi luật CSS: phải ghi đè thẳng vào style inline.
    const hideBodyChild = el => {
      if (el === moved || el.nodeType !== 1) return;
      snapshotAttr(state, el, 'style');
      if (el.style.getPropertyValue('display') !== 'none' || el.style.getPropertyPriority('display') !== 'important') {
        el.style.setProperty('display', 'none', 'important');
      }
      state.bodyObserver.observe(el, { attributes: true, attributeFilter: ['style'] });
    };
    state.bodyObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') m.addedNodes.forEach(hideBodyChild);
        else hideBodyChild(m.target);
      }
    });
    state.bodyObserver.observe(document.body, { childList: true });
    Array.from(document.body.children).forEach(hideBodyChild);
  }

  // Bên trong root: giữ các wrapper trung gian (reset khoảng trống), ẩn quảng cáo/spacer/placeholder.
  function cleanRoot(state, root, pages) {
    addClass(state, root, 'snp-root');
    neutralizeBreaks(state, root);

    const wrappers = new Set();
    for (const { el } of pages) {
      for (let n = el.parentElement; n && n !== root; n = n.parentElement) wrappers.add(n);
    }
    for (const wrapper of wrappers) {
      addClass(state, wrapper, 'snp-wrap');
      neutralizeBreaks(state, wrapper);
    }
    // querySelectorAll trả về theo thứ tự tài liệu nên cha luôn được xử lý trước con.
    for (const el of root.querySelectorAll('*')) {
      if (wrappers.has(el) || el.closest(PAGE_SELECTOR)) continue;
      if (el.parentElement?.classList.contains('snp-hide')) continue;
      addClass(state, el, 'snp-hide');
    }
  }

  function preparePages(state, pages) {
    for (const [position, { el: page, index }] of pages.entries()) {
      const size = pageSize(page);
      if (!size.width || !size.height) throw new Error(`Không đọc được kích thước trang ${index}.`);
      // Làm tròn xuống để phần tử không bao giờ lớn hơn @page dù chỉ 0.01px.
      const width = Math.floor(size.width);
      const height = Math.floor(size.height);
      const isLast = position === pages.length - 1;

      snapshotAttr(state, page, 'style');
      addClass(state, page, 'snp-page');
      if (isLast) addClass(state, page, 'snp-last-page');
      const set = (property, value) => page.style.setProperty(property, value, 'important');
      set('width', `${width}px`);
      set('height', `${height}px`);
      set('overflow', 'hidden');
      set('break-before', 'auto');
      set('page-break-before', 'auto');
      set('break-inside', 'avoid-page');
      set('page-break-inside', 'avoid');
      set('break-after', isLast ? 'auto' : 'page');
      set('page-break-after', isLast ? 'auto' : 'always');
      state.pageSizes.set(index, { width, height });
    }
  }

  function injectPrintStyle(state, pages) {
    // Các trang cùng kích thước dùng chung một loại @page; chỉ đặt tên khi có nhiều kích thước.
    const sizes = new Map();
    for (const { index } of pages) {
      const { width, height } = state.pageSizes.get(index);
      const key = `${width}x${height}`;
      if (!sizes.has(key)) sizes.set(key, { width, height, name: `snp_size_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}` });
    }
    const list = Array.from(sizes.values());
    let pageRules;
    if (list.length > 1) {
      for (const { el: page, index } of pages) {
        const { width, height } = state.pageSizes.get(index);
        snapshotAttr(state, page, 'data-snp-page-type');
        page.setAttribute('data-snp-page-type', sizes.get(`${width}x${height}`).name);
      }
      pageRules = list.map(({ name, width, height }) =>
        `@page ${name}{size:${width + PAGE_PAD}px ${height + PAGE_PAD}px;margin:0}` +
        `.snp-page[data-snp-page-type="${name}"]{page:${name}!important;width:${width}px!important;height:${height}px!important}`
      ).join('\n');
    } else {
      pageRules = `@page{size:${list[0].width + PAGE_PAD}px ${list[0].height + PAGE_PAD}px;margin:0}`;
    }

    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = `
      @media print {
        ${pageRules}
        @page { margin: 0; }
        html, body { margin:0!important; padding:0!important; width:auto!important; height:auto!important; min-height:0!important; overflow:visible!important; background:#fff!important; }
        html, body, .snp-printwrap, .snp-wrap, .snp-root { break-before:auto!important; page-break-before:auto!important; break-after:auto!important; page-break-after:auto!important; }
        html::before, html::after, body::before, body::after,
        .snp-printwrap::before, .snp-printwrap::after, .snp-wrap::before, .snp-wrap::after,
        .snp-root::before, .snp-root::after, .snp-page::before, .snp-page::after { display:none!important; content:none!important; }
        html > body > :not(.snp-printwrap) { display:none!important; }
        .snp-printwrap, .snp-root, .snp-wrap { display:block!important; visibility:visible!important; position:static!important; inset:auto!important; width:auto!important; height:auto!important; min-width:0!important; min-height:0!important; max-width:none!important; max-height:none!important; margin:0!important; padding:0!important; border:0!important; overflow:visible!important; transform:none!important; filter:none!important; }
        .snp-root * { visibility:visible!important; }
        .snp-page { display:block!important; position:relative!important; box-sizing:border-box!important; margin:0!important; padding:0!important; border:0!important; overflow:hidden!important; opacity:1!important; visibility:visible!important; break-before:auto!important; page-break-before:auto!important; break-inside:avoid-page!important; page-break-inside:avoid!important; break-after:page!important; page-break-after:always!important; }
        .snp-last-page { break-after:auto!important; page-break-after:auto!important; }
        .snp-hide, .snp-page :is(.b_tl,.b_tr,.b_br,.b_bl,.b_t,.b_r,.b_b,.b_l,.highlighter_canvas) { display:none!important; }
      }
    `;
    document.head.appendChild(style);
    state.style = style;
  }

  // React / docManager của Scribd có thể ghi đè thuộc tính class (vd bật/tắt "not_visible"),
  // làm mất class snp-* của mình: gắn lại ngay nếu bị mất.
  function guardClasses(state) {
    state.observer = new MutationObserver(mutations => {
      for (const { target } of mutations) {
        for (const name of state.addedClasses.get(target) || []) {
          if (!target.classList.contains(name)) target.classList.add(name);
        }
      }
    });
    for (const element of state.addedClasses.keys()) {
      state.observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function installPrintMode(viewer, state) {
    const { root, pages } = viewer;
    isolateContainer(state, root);
    cleanRoot(state, root, pages);
    preparePages(state, pages);
    injectPrintStyle(state, pages);
    guardClasses(state);
  }

  function restore() {
    const state = window[STATE_KEY];
    if (!state) return { restored: false };
    state.observer?.disconnect();
    state.bodyObserver?.disconnect();
    state.style?.remove();
    state.hydrationStyle?.remove();
    if (state.moved) {
      const { node, parent, next } = state.moved;
      if (parent?.isConnected) {
        if (next && next.parentNode === parent) parent.insertBefore(node, next);
        else parent.appendChild(node);
      }
    }
    for (const [element, originalClass] of state.classSnapshots) {
      if (originalClass === null) element.removeAttribute('class');
      else element.setAttribute('class', originalClass);
    }
    for (const [element, attrs] of state.attrSnapshots) {
      for (const [name, originalValue] of attrs) {
        if (originalValue === null) element.removeAttribute(name);
        else element.setAttribute(name, originalValue);
      }
    }
    if (state.scroll) window.scrollTo(state.scroll.x, state.scroll.y);
    delete window[STATE_KEY];
    return { restored: true };
  }

  async function start(options = {}) {
    const viewer = findViewer();
    if (!viewer) return { ok: false, error: 'Không tìm thấy .outer_page_container có trang Scribd.' };
    if (window[STATE_KEY]) return { ok: true, pageCount: viewer.pages.length, alreadyPrepared: true };

    const state = {
      classSnapshots: new Map(),
      addedClasses: new Map(),
      attrSnapshots: new Map(),
      pageSizes: new Map(),
      observer: null,
      bodyObserver: null,
      moved: null,
      scroll: null,
      style: null,
      hydrationStyle: null
    };
    window[STATE_KEY] = state;
    try {
      const speedFactor = Number.isFinite(options.speedFactor) ? options.speedFactor : 1;
      await hydrate(viewer, state, Math.min(2, Math.max(0.4, speedFactor)));
      installPrintMode(viewer, state);
      return { ok: true, pageCount: viewer.pages.length };
    } catch (error) {
      restore();
      return { ok: false, error: error.message || String(error) };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SNP_PING') {
      const viewer = findViewer();
      sendResponse({ pageCount: viewer ? viewer.pages.length : 0 });
      return;
    }
    if (message?.type === 'SNP_START') {
      start(message.options || {}).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === 'SNP_PRINT') {
      try {
        if (!window[STATE_KEY]) throw new Error('Trang chưa được chuẩn bị.');
        window.print();
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
      return;
    }
    if (message?.type === 'SNP_RESTORE') {
      sendResponse(restore());
    }
  });

  window.addEventListener('afterprint', () => restore());
})();
