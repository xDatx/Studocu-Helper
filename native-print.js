(() => {
  if (globalThis.StudocuNativePrint) return;

  const state = {
    phase: 'idle',
    message: 'Sẵn sàng',
    pageCount: 0,
    textPageCount: 0
  };

  const frame = () =>
    new Promise(resolve =>
      requestAnimationFrame(() => resolve())
    );

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  let pageStyle = null;
  let pageEls = [];
  let touched = [];
  let savedScroll = null;

  const hasText = p =>
    Boolean(p.textContent.trim());


  // ============================================================
  // RESTORE
  // ============================================================

  function restore(message = 'Đã khôi phục trang gốc.') {
    document.body?.classList.remove('studocu-native-print');

    touched.forEach(el => {
      el.classList.remove('sn-anc', 'sn-hide');
    });

    pageEls.forEach(el => {
      el.classList.remove(
        'studocu-valid-page',
        'studocu-native-print-last'
      );

      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.style.removeProperty('page');
    });

    pageStyle?.remove();

    pageStyle = null;
    touched = [];
    pageEls = [];

    /*
     * Quay lại vị trí scroll ban đầu
     * sau khi đóng Print Preview.
     */
    if (savedScroll) {
      const { x, y } = savedScroll;
      savedScroll = null;

      requestAnimationFrame(() => {
        window.scrollTo(x, y);
      });
    }

    Object.assign(state, {
      phase: 'idle',
      message,
      pageCount: 0,
      textPageCount: 0
    });
  }


  // ============================================================
  // PAGE INDEX
  // ============================================================

  function readIndex(p) {
    const el =
      p.hasAttribute('data-page-index')
        ? p
        : p.closest('[data-page-index]') ||
          p.querySelector('[data-page-index]');

    const raw =
      el?.getAttribute('data-page-index');

    return (
      raw != null &&
      raw !== '' &&
      !isNaN(+raw)
    )
      ? +raw
      : null;
  }


  // ============================================================
  // COLLECT PAGE-CONTENT
  // ============================================================

  function collectPages() {
    const all = [
      ...document.querySelectorAll('.page-content')
    ];

    /*
     * Chỉ lấy page-content ngoài cùng.
     */
    const outer = all.filter(
      p => !p.parentElement?.closest('.page-content')
    );

    const map = new Map();

    outer.forEach((p, i) => {
      const idx = readIndex(p) ?? i;
      const old = map.get(idx);

      /*
       * Nếu trùng index thì ưu tiên node có text.
       */
      if (
        !old ||
        (!hasText(old) && hasText(p))
      ) {
        map.set(idx, p);
      }
    });

    const indexes = [
      ...map.keys()
    ].sort((a, b) => a - b);

    const missing = [];

    for (
      let i = indexes[0] ?? 0;
      i <= (indexes.at(-1) ?? -1);
      i++
    ) {
      if (!map.has(i)) {
        missing.push(i);
      }
    }

    return {
      pages: indexes.map(i => map.get(i)),
      indexes,
      missing,
      rawCount: all.length
    };
  }


  // ============================================================
  // MARK PRINT LAYOUT
  // ============================================================

  function markLayout(pages) {
    const keep = new Set();

    pages.forEach(p => {
      for (
        let el = p.parentElement;
        el && el !== document.documentElement;
        el = el.parentElement
      ) {
        keep.add(el);
      }
    });

    const pageSet = new Set(pages);

    keep.forEach(el => {
      el.classList.add('sn-anc');
      touched.push(el);
    });

    keep.forEach(anc => {
      [...anc.children].forEach(ch => {
        if (
          !keep.has(ch) &&
          !pageSet.has(ch)
        ) {
          ch.classList.add('sn-hide');
          touched.push(ch);
        }
      });
    });

    pages.forEach(p => {
      p.classList.add('studocu-valid-page');
    });

    pages
      .at(-1)
      ?.classList.add('studocu-native-print-last');

    pageEls = pages;

    document.body.classList.add(
      'studocu-native-print'
    );
  }


  // ============================================================
  // HYDRATION CHECK
  // ============================================================

  /*
   * Xem page-content đã được Studocu
   * populate dữ liệu hay chưa.
   */
  function hasMaterializedContent(p) {
    if (hasText(p)) {
      return true;
    }

    return Boolean(
      p.querySelector(
        [
          'img',
          'picture',
          'svg',
          'canvas',
          'table',
          'figure',
          'video',
          'iframe',
          'object',
          'embed'
        ].join(',')
      )
    );
  }


  function hydrationStats() {
    const { pages } = collectPages();

    const hydrated = pages.filter(
      hasMaterializedContent
    ).length;

    return {
      hydrated,
      total: pages.length
    };
  }


  // ============================================================
  // AUTO SCROLL -> HYDRATE DOM
  // ============================================================

async function hydrateAllPages(scrollStep = 0.25) {
      const scroller =
      document.scrollingElement ||
      document.documentElement;

    /*
     * Nhớ vị trí ban đầu.
     */
    if (!savedScroll) {
      savedScroll = {
        x: window.scrollX,
        y: window.scrollY
      };
    }

    /*
     * Tạm thời tắt smooth scrolling.
     */
    const oldScrollBehavior =
      scroller.style.getPropertyValue(
        'scroll-behavior'
      );

    const oldPriority =
      scroller.style.getPropertyPriority(
        'scroll-behavior'
      );

    scroller.style.setProperty(
      'scroll-behavior',
      'auto',
      'important'
    );

    /*
     * Tài liệu dài 300 trang vẫn có đủ thời gian.
     *
     * Đây chỉ là timeout TỐI ĐA.
     * Nếu xuống đáy và DOM ổn định sớm thì thoát ngay.
     */
    const maxWaitMs = 120000;

    /*
     * Mỗi lần scroll nghỉ 50ms.
     */
    const scrollDelayMs = 10;

    /*
     * Mỗi nhịp đi xuống 1/4 viewport.
     *
     * 0.25 = 25% viewport.
     */

    /*
     * Khi tới đáy:
     * nếu số page hydrate không thay đổi
     * trong 1.5 giây thì xem như hoàn tất.
     */
    const stableNeededMs = 1500;

    const startedAt =
      performance.now();

    let lastHydrated = -1;
    let lastTotal = -1;

    let stableSince =
      performance.now();

    try {
      while (
        performance.now() - startedAt <
        maxWaitMs
      ) {
        /*
         * scrollHeight có thể tăng trong lúc
         * Studocu populate thêm DOM.
         *
         * Vì vậy phải tính maxY lại mỗi vòng.
         */
        const maxY =
          Math.max(
            0,
            scroller.scrollHeight -
              window.innerHeight
          );

        /*
         * Đi xuống 1/4 viewport mỗi nhịp.
         */
        const nextY =
          Math.min(
            window.scrollY +
              window.innerHeight *
                scrollStep,
            maxY
          );

        window.scrollTo(
          0,
          nextY
        );

        /*
         * Cho Studocu thời gian xử lý scroll,
         * IntersectionObserver, render DOM...
         */
        await sleep(
          scrollDelayMs
        );

        const {
          hydrated,
          total
        } = hydrationStats();

        Object.assign(state, {
          phase: 'preparing',

          message:
            `Đang nạp nội dung trang… ${hydrated}/${total}`,

          pageCount: total
        });

        /*
         * Nếu số page hydrate thay đổi,
         * reset timer ổn định.
         */
        if (
          hydrated !== lastHydrated ||
          total !== lastTotal
        ) {
          lastHydrated =
            hydrated;

          lastTotal =
            total;

          stableSince =
            performance.now();
        }

        /*
         * Chỉ xét "ổn định" khi đã
         * thực sự xuống gần cuối trang.
         */
        const reachedBottom =
          window.scrollY >=
          maxY - 10;

        if (
          reachedBottom &&
          performance.now() -
            stableSince >=
            stableNeededMs
        ) {
          return {
            hydrated,
            total,
            timedOut: false
          };
        }
      }

      /*
       * Timeout:
       * vẫn tiếp tục in bằng những dữ liệu
       * đã hydrate được thay vì treo extension.
       */
      const {
        hydrated,
        total
      } = hydrationStats();

      return {
        hydrated,
        total,
        timedOut: true
      };
    }

    finally {
      /*
       * Khôi phục scroll-behavior cũ.
       */
      if (oldScrollBehavior) {
        scroller.style.setProperty(
          'scroll-behavior',
          oldScrollBehavior,
          oldPriority
        );
      }

      else {
        scroller.style.removeProperty(
          'scroll-behavior'
        );
      }
    }
  }


  // ============================================================
  // FORCE IMAGE LAZY -> EAGER
  // ============================================================

  async function forceEagerImages(pages) {
    const imgSet = new Set();
    const sourceSet = new Set();

    pages.forEach(p => {
      p
        .querySelectorAll('img')
        .forEach(img => {
          imgSet.add(img);
        });

      p
        .querySelectorAll(
          'picture source, source'
        )
        .forEach(source => {
          sourceSet.add(source);
        });
    });

    const imgs = [...imgSet];
    const sources = [...sourceSet];


    /*
     * SOURCE trong picture.
     */
    sources.forEach(source => {
      const lazySrcset =
        source.dataset.srcset ||
        source.getAttribute(
          'data-srcset'
        ) ||
        source.getAttribute(
          'data-lazy-srcset'
        );

      if (
        lazySrcset &&
        !source.getAttribute('srcset')
      ) {
        source.setAttribute(
          'srcset',
          lazySrcset
        );
      }
    });


    /*
     * IMG
     */
    imgs.forEach(img => {
      /*
       * Quan trọng:
       * Studocu đã tạo <img> rồi
       * thì mới chuyển lazy -> eager.
       */
      img.loading = 'eager';

      /*
       * Không ép toàn bộ thành high.
       *
       * 300 ảnh cùng priority high
       * có thể gây nghẽn hàng đợi tải.
       */
      try {
        img.fetchPriority = 'auto';
      }
      catch {}


      /*
       * Hỗ trợ các dạng lazy URL
       * thường gặp.
       */
      const lazySrc =
        img.dataset.src ||
        img.getAttribute(
          'data-src'
        ) ||
        img.getAttribute(
          'data-lazy-src'
        ) ||
        img.getAttribute(
          'data-original'
        ) ||
        img.getAttribute(
          'data-url'
        );


      const lazySrcset =
        img.dataset.srcset ||
        img.getAttribute(
          'data-srcset'
        ) ||
        img.getAttribute(
          'data-lazy-srcset'
        );


      if (
        lazySrcset &&
        !img.getAttribute('srcset')
      ) {
        img.setAttribute(
          'srcset',
          lazySrcset
        );
      }


      const currentSrc =
        img.getAttribute('src');

      /*
       * Nếu src hiện tại chưa có,
       * hoặc chỉ là data placeholder,
       * dùng URL thật từ data-*.
       */
      if (
        lazySrc &&
        (
          !currentSrc ||
          currentSrc.startsWith('data:')
        )
      ) {
        img.setAttribute(
          'src',
          lazySrc
        );
      }
    });


    /*
     * Chỉ lấy các img thực sự có URL.
     */
    const loadable =
      imgs.filter(img =>
        Boolean(
          img.currentSrc ||
          img.getAttribute('src') ||
          img.getAttribute('srcset')
        )
      );


    if (!loadable.length) {
      return {
        total: 0,
        loaded: 0,
        failed: 0
      };
    }


    Object.assign(state, {
      phase: 'preparing',

      message:
        `Đang tải ${loadable.length} ảnh…`
    });


    /*
     * Tất cả ảnh được chờ song song.
     *
     * Không phải:
     * ảnh 1 xong -> ảnh 2 -> ảnh 3...
     */
    const maxImageWaitMs = 15000;


    await Promise.allSettled(
      loadable.map(img => {
        /*
         * Ảnh đã tải hoặc đã lỗi xong.
         */
        if (img.complete) {
          return Promise.resolve();
        }

        return new Promise(resolve => {
          let done = false;

          const finish = () => {
            if (done) return;

            done = true;
            resolve();
          };

          img.addEventListener(
            'load',
            finish,
            { once: true }
          );

          img.addEventListener(
            'error',
            finish,
            { once: true }
          );

          /*
           * Một ảnh không được phép
           * treo toàn bộ extension.
           */
          setTimeout(
            finish,
            maxImageWaitMs
          );
        });
      })
    );


    const loaded =
      loadable.filter(
        img =>
          img.complete &&
          img.naturalWidth > 0
      ).length;


    const failed =
      loadable.filter(
        img =>
          img.complete &&
          img.naturalWidth === 0
      ).length;


    return {
      total: loadable.length,
      loaded,
      failed
    };
  }


  // ============================================================
  // MEASURE PAGE
  // ============================================================

  /*
   * Giữ nguyên:
   *
   * - crop khoảng trắng bên phải
   * - không đổi font
   * - không scale
   * - không crop chiều cao
   */
  function measure(p) {
    const pageRect =
      p.getBoundingClientRect();

    let contentRight = 0;


    /*
     * 1. Media thật.
     *
     * Không đo tất cả div vì wrapper Studocu
     * thường rộng bằng viewport.
     */
    p.querySelectorAll(
      [
        'table',
        'img',
        'svg',
        'canvas',
        'pre',
        'figure',
        'video',
        'iframe',
        'object',
        'embed'
      ].join(',')
    ).forEach(el => {
      const style =
        getComputedStyle(el);

      if (
        style.display === 'none' ||
        style.visibility === 'hidden'
      ) {
        return;
      }

      const r =
        el.getBoundingClientRect();

      if (
        r.width > 0 &&
        r.height > 0
      ) {
        contentRight =
          Math.max(
            contentRight,
            r.right -
              pageRect.left
          );
      }
    });


    /*
     * 2. Text thật.
     */
    const walker =
      document.createTreeWalker(
        p,
        NodeFilter.SHOW_TEXT
      );

    let node;

    while (
      (
        node =
          walker.nextNode()
      )
    ) {
      if (
        !node.textContent?.trim()
      ) {
        continue;
      }

      const parent =
        node.parentElement;

      if (parent) {
        const style =
          getComputedStyle(parent);

        if (
          style.display === 'none' ||
          style.visibility === 'hidden'
        ) {
          continue;
        }
      }


      const range =
        document.createRange();

      range.selectNodeContents(node);


      for (
        const r of
        range.getClientRects()
      ) {
        if (
          r.width > 0 &&
          r.height > 0
        ) {
          contentRight =
            Math.max(
              contentRight,
              r.right -
                pageRect.left
            );
        }
      }


      range.detach?.();
    }


    /*
     * Width gốc fallback.
     */
    const originalW =
      Math.ceil(
        Math.max(
          p.offsetWidth,
          p.scrollWidth,
          pageRect.width
        )
      );


    /*
     * Chừa 16px bên phải.
     */
    const croppedW =
      contentRight > 0
        ? Math.ceil(
            contentRight + 16
          )
        : originalW;


    /*
     * Height giữ nguyên hoàn toàn.
     */
    const h =
      Math.ceil(
        Math.max(
          p.offsetHeight,
          p.scrollHeight,
          pageRect.height
        )
      );


    return {
      w:
        Math.min(
          originalW,
          croppedW
        ),

      h,

      boxW:
        p.offsetWidth,

      boxH:
        p.offsetHeight,

      scrollW:
        p.scrollWidth,

      scrollH:
        p.scrollHeight
    };
  }


  // ============================================================
  // START
  // ============================================================

  async function start(options = {}) {
      const requestedStep =
    Number(options.scrollStep);

  const scrollStep =
    Number.isFinite(requestedStep)
      ? Math.min(
          1,
          Math.max(
            0.05,
            requestedStep
          )
        )
      : 0.25;
    if (
      state.phase === 'printing' ||
      state.phase === 'preparing'
    ) {
      return {
        ...state
      };
    }


    /*
     * Đọc shell ban đầu.
     */
    const initial =
      collectPages();


    if (!initial.pages.length) {
      Object.assign(state, {
        phase: 'error',

        message:
          'Không tìm thấy .page-content trong tài liệu.'
      });

      return {
        ...state
      };
    }


    Object.assign(state, {
      phase: 'preparing',

      message:
        `Đang kích hoạt nội dung ${initial.pages.length} trang…`,

      pageCount:
        initial.pages.length
    });


    try {
      /*
       * BƯỚC 1:
       *
       * Auto scroll xuống từ từ
       * để Studocu populate:
       *
       * text
       * img
       * table
       * ...
       */
      const hydration =
        await hydrateAllPages(
          scrollStep
        );


      /*
       * BƯỚC 2:
       *
       * DOM đã thay đổi.
       * BẮT BUỘC collect lại.
       */
      const refreshed =
        collectPages();


      Object.assign(state, {
        phase: 'preparing',

        message:
          hydration.timedOut
            ? (
              `Đã nạp ${hydration.hydrated}/${hydration.total} trang ` +
              `(hết thời gian chờ) • Đang tải ảnh…`
            )
            : (
              `Đã nạp ${hydration.hydrated}/${hydration.total} trang ` +
              `• Đang tải ảnh…`
            ),

        pageCount:
          refreshed.pages.length
      });


      /*
       * BƯỚC 3:
       *
       * Sau khi <img> đã xuất hiện,
       * mới force lazy -> eager.
       */
      const imageResult =
        await forceEagerImages(
          refreshed.pages
        );


      Object.assign(state, {
        phase: 'preparing',

        message:
          `Ảnh ${imageResult.loaded}/${imageResult.total} đã tải ` +
          `• Đang chuẩn bị bố cục in…`,

        pageCount:
          refreshed.pages.length
      });


      /*
       * BƯỚC 4:
       *
       * Sau cùng mới sửa layout
       * để phục vụ print.
       */
      await prepare(
        refreshed.pages,
        refreshed.indexes,
        refreshed.missing,
        refreshed.rawCount
      );
    }

    catch (e) {
      restore();

      Object.assign(state, {
        phase: 'error',

        message:
          e?.message ||
          String(e)
      });
    }


    return {
      ...state
    };
  }


  // ============================================================
  // PREPARE PRINT
  // ============================================================

  async function prepare(
    pages,
    indexes,
    missing,
    rawCount
  ) {
    try {
      /*
       * Tới đây Studocu đã hydrate xong.
       *
       * Giờ mới ép:
       * display:block
       * wrapper
       * print layout...
       */
      markLayout(pages);


      await frame();
      await frame();


      if (document.fonts) {
        await document.fonts.ready;
      }


      // --------------------------------------------------------
      // 1. MEASURE
      // --------------------------------------------------------

      const sizes =
        pages.map(measure);


      const ref =
        sizes.find(
          s =>
            s.w > 0 &&
            s.h > 0
        );


      if (!ref) {
        throw new Error(
          'Không đo được kích thước trang (đều bằng 0).'
        );
      }


      sizes.forEach(s => {
        if (
          !(
            s.w > 0 &&
            s.h > 0
          )
        ) {
          s.w = ref.w;
          s.h = ref.h;
          s.fallback = true;
        }
      });


      // --------------------------------------------------------
      // 2. PAGE SIZE
      // --------------------------------------------------------

      const names =
        new Map();


      pages.forEach((p, i) => {
        const {
          w,
          h
        } = sizes[i];


        const key =
          `sn-${w}x${h}`;


        names.set(
          key,
          {
            w,
            h
          }
        );


        p.style.setProperty(
          'width',
          w + 'px',
          'important'
        );


        p.style.setProperty(
          'height',
          h + 'px',
          'important'
        );


        p.style.setProperty(
          'page',
          key
        );
      });


      pageStyle =
        document.createElement(
          'style'
        );


      pageStyle.textContent =
        '@media print {\n' +

        [...names]
          .map(
            ([k, v]) =>
              `  @page ${k} { size: ${v.w}px ${v.h}px; margin: 0; }`
          )
          .join('\n') +

        '\n}';


      document.head.appendChild(
        pageStyle
      );


      await frame();


      // --------------------------------------------------------
      // 3. DEBUG
      // --------------------------------------------------------

      const rows =
        pages.map((p, i) => {
          const r =
            p.getBoundingClientRect();

          return {
            index:
              indexes[i],

            width:
              sizes[i].w,

            height:
              sizes[i].h,

            box:
              `${sizes[i].boxW}x${sizes[i].boxH}`,

            scroll:
              `${sizes[i].scrollW}x${sizes[i].scrollH}`,

            visual:
              `${Math.round(r.width)}x${Math.round(r.height)}`,

            text:
              hasText(p)
          };
        });


      console.table(rows);


      const skewed =
        rows.filter(r => {
          const [
            vw,
            vh
          ] =
            r.visual
              .split('x')
              .map(Number);


          return (
            Math.abs(
              vw - r.width
            ) > 2 ||

            Math.abs(
              vh - r.height
            ) > 2
          );
        }).length;


      const sizeCount =
        names.size;


      const textPageCount =
        pages.filter(
          hasText
        ).length;


      let msg =
        `Đang in ${pages.length} trang ` +
        `(index ${indexes[0]}–${indexes.at(-1)}) ` +
        `• ${rawCount} node .page-content`;


      msg +=
        sizeCount === 1
          ? ` • Khổ ${ref.w}×${ref.h}px`
          : ` • ${sizeCount} khổ khác nhau`;


      if (
        pages.length -
        textPageCount
      ) {
        msg +=
          ` • Không có chữ: ${
            pages.length -
            textPageCount
          }`;
      }


      if (skewed) {
        msg +=
          ` • Lệch transform: ${skewed} trang`;
      }


      if (missing.length) {
        msg +=
          ` • THIẾU index: ` +
          `${missing
            .slice(0, 10)
            .join(', ')}` +
          `${missing.length > 10 ? '…' : ''}`;
      }


      Object.assign(state, {
        phase: 'printing',
        message: msg,
        pageCount: pages.length,
        textPageCount
      });


      window.addEventListener(
        'afterprint',

        () =>
          restore(
            'Đã đóng hộp thoại in.'
          ),

        {
          once: true
        }
      );


      requestAnimationFrame(
        () => window.print()
      );
    }

    catch (e) {
      restore();

      Object.assign(state, {
        phase: 'error',
        message: e.message
      });
    }
  }


  // ============================================================
  // API
  // ============================================================

  const api = {
    start,
    restore,

    getState: () => ({
      ...state
    })
  };


  globalThis.StudocuNativePrint =
    api;


  // ============================================================
  // MESSAGE LISTENER
  // ============================================================

  chrome.runtime.onMessage.addListener(
    (
      message,
      _sender,
      respond
    ) => {
      if (
        message?.namespace !==
        'studocu-native-print'
      ) {
        return;
      }


      if (
        message.command ===
        'status'
      ) {
        respond(
          api.getState()
        );
      }

      else if (
        message.command ===
        'start'
      ) {
        api
          .start(
            message.options || {}
          )
          .then(respond);
      }


      else if (
        message.command ===
        'restore'
      ) {
        api.restore();

        respond(
          api.getState()
        );
      }


      return true;
    }
  );
})();