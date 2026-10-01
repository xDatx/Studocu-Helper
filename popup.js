const printButton =
  document.getElementById(
    'printBtn'
  );

const restoreButton =
  document.getElementById(
    'restoreBtn'
  );

const statusBox =
  document.getElementById(
    'status'
  );

const speedRange =
  document.getElementById(
    'speedRange'
  );

const speedLabel =
  document.getElementById(
    'speedLabel'
  );

const clearButton =
  document.getElementById(
    'clearBtn'
  );
  
let tabId;


/*
 * 4 mức tốc độ.
 *
 * Mức 2 chính là tốc độ hiện tại:
 * 0.25 viewport / 50ms.
 */
const SPEEDS = {
  1: {
    label: 'Chậm',
    scrollStep: 0.125
  },

  2: {
    label: 'Vừa',
    scrollStep: 0.25
  },

  3: {
    label: 'Nhanh',
    scrollStep: 0.5
  },

  4: {
    label: 'Rất nhanh',
    scrollStep: 1
  }
};


clearButton.addEventListener(
  'click',

  async () => {
    clearButton.disabled = true;

    statusBox.classList.remove('error');

    statusBox.textContent =
      'Đang quét và xóa cookie...';

    try {
      const allCookies =
        await chrome.cookies.getAll({});

      let count = 0;

      for (const cookie of allCookies) {
        if (
          cookie.domain.includes('studocu')
        ) {
          const cleanDomain =
            cookie.domain.startsWith('.')
              ? cookie.domain.substring(1)
              : cookie.domain;

          const protocol =
            cookie.secure
              ? 'https:'
              : 'http:';

          const url =
            `${protocol}//${cleanDomain}${cookie.path}`;

          await chrome.cookies.remove({
            url: url,
            name: cookie.name,
            storeId: cookie.storeId
          });

          count++;
        }
      }

      statusBox.textContent =
        `Đã xóa ${count} cookies! Đang tải lại...`;

      setTimeout(
        () => {
          chrome.tabs.query(
            {
              active: true,
              currentWindow: true
            },

            tabs => {
              if (tabs[0]) {
                chrome.tabs.reload(
                  tabs[0].id
                );
              }
            }
          );
        },

        1000
      );
    }

    catch (e) {
      console.error(e);

      statusBox.classList.add('error');

      statusBox.textContent =
        'Lỗi: ' + e.message;

      clearButton.disabled = false;
    }
  }
);
/*
 * Khôi phục tốc độ người dùng
 * đã chọn lần trước.
 */
const savedSpeed =
  localStorage.getItem(
    'studocu-print-speed'
  );


if (
  savedSpeed &&
  SPEEDS[savedSpeed]
) {
  speedRange.value =
    savedSpeed;
}


function updateSpeedUI() {
  const selected =
    SPEEDS[
      speedRange.value
    ] || SPEEDS[2];

  speedLabel.textContent =
    selected.label;
}


updateSpeedUI();


speedRange.addEventListener(
  'input',
  () => {
    updateSpeedUI();

    localStorage.setItem(
      'studocu-print-speed',
      speedRange.value
    );
  }
);


/*
 * Hiển thị trạng thái.
 */
function show(state) {
  statusBox.textContent =
    state.message;

  statusBox.classList.toggle(
    'error',
    state.phase === 'error'
  );


  const busy =
    state.phase === 'printing' ||
    state.phase === 'preparing';


  printButton.disabled =
    busy;

  speedRange.disabled =
    busy;


  restoreButton.hidden =
    state.phase !== 'printing';


  if (
    state.phase === 'printing' &&
    state.textPageCount !== undefined
  ) {
    statusBox.textContent +=
      ` • Có chữ: ${state.textPageCount} trang`;

    if (
      state.imageOnlyCount
    ) {
      statusBox.textContent +=
        ` • Chỉ ảnh: ${state.imageOnlyCount} trang`;
    }
  }
}


/*
 * Kết nối tab Studocu.
 */
async function connect() {
  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });


  if (
    !tab?.id ||
    !/^https?:\/\/(?:[^/]+\.)?studocu\.(?:com|vn)(?:\/|$)/i.test(
      tab.url || ''
    )
  ) {
    throw new Error(
      'Hãy mở tài liệu Studocu trước.'
    );
  }


  tabId =
    tab.id;


  await chrome.scripting.insertCSS({
    target: {
      tabId
    },

    files: [
      'native-print.css'
    ]
  });


  await chrome.scripting.executeScript({
    target: {
      tabId
    },

    files: [
      'native-print.js'
    ]
  });


  show(
    await chrome.tabs.sendMessage(
      tabId,
      {
        namespace:
          'studocu-native-print',

        command:
          'status'
      }
    )
  );
}


/*
 * Khôi phục.
 */
restoreButton.addEventListener(
  'click',

  async () => {
    try {
      show(
        await chrome.tabs.sendMessage(
          tabId,
          {
            namespace:
              'studocu-native-print',

            command:
              'restore'
          }
        )
      );
    }

    catch (error) {
      show({
        phase: 'error',
        message: error.message
      });
    }
  }
);


/*
 * PRINT
 */
printButton.addEventListener(
  'click',

  async () => {
    const selected =
      SPEEDS[
        speedRange.value
      ] || SPEEDS[2];


    printButton.disabled =
      true;

    speedRange.disabled =
      true;


    try {
      show(
        await chrome.tabs.sendMessage(
          tabId,
          {
            namespace:
              'studocu-native-print',

            command:
              'start',

            options: {
              scrollStep:
                selected.scrollStep
            }
          }
        )
      );
    }

    catch (error) {
      show({
        phase: 'error',
        message: error.message
      });
    }
  }
);


/*
 * CONNECT
 */
connect()
  .then(() => {
    const timer =
      setInterval(
        async () => {
          try {
            show(
              await chrome.tabs.sendMessage(
                tabId,
                {
                  namespace:
                    'studocu-native-print',

                  command:
                    'status'
                }
              )
            );
          }

          catch {
            clearInterval(
              timer
            );
          }
        },

        500
      );


    window.addEventListener(
      'pagehide',

      () =>
        clearInterval(
          timer
        )
    );
  })

  .catch(error => {
    printButton.disabled =
      true;

    speedRange.disabled =
      true;

    show({
      phase: 'error',
      message: error.message
    });
  });