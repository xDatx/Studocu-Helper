/*
 * Xóa cookie theo logic code cũ: quét toàn bộ cookies có chứa domain 'studocu'
 */
async function clearCookiesOldLogic() {
  const allCookies = await chrome.cookies.getAll({});
  let count = 0;

  for (const cookie of allCookies) {
    if (cookie.domain.includes('studocu')) {
      let cleanDomain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain;
      const protocol = cookie.secure ? 'https:' : 'http:';
      const url = `${protocol}//${cleanDomain}${cookie.path}`;

      const details = {
        url: url,
        name: cookie.name,
        storeId: cookie.storeId
      };

      if (cookie.partitionKey) {
        details.partitionKey = cookie.partitionKey;
      }

      try {
        await chrome.cookies.remove(details);
        count++;
      } catch (e) {
        console.warn('Không xóa được cookie:', cookie.name, e);
      }
    }
  }

  return count;
}

/*
 * Nhận lệnh từ popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CLEAR_COOKIES_OLD_LOGIC') {
    clearCookiesOldLogic()
      .then(count => sendResponse({ ok: true, count }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true; // Giữ kênh message bất đồng bộ
  }
});