async function fetchDocument() {
    const { documentAccess, pageDataList } = JSON.parse(__NEXT_DATA__.innerText).props.pageProps;
    const { url, objectKey, signedQueryParams } = documentAccess;
    const params = signedQueryParams.global;

    const pageContainer = document.createElement('div');
    pageContainer.classList.add('p2hv');
    pageContainer.id = 'page-container';

    await Promise.all(pageDataList.map(async pageData => {
        let pageHtml = pageData.pageHtml;

        if (!pageHtml) {
            const pageUrl = `${url}${objectKey}${pageData.pageNumber}.page${params}`;
            const pageResponse = await fetch(pageUrl);
            pageHtml = await pageResponse.text();

            const backgroundFile = `bg${pageData.pageNumber.toString(16)}.png`;
            const backgroundUrl = `${url}${backgroundFile}${params}`
            pageHtml = pageHtml.replace(backgroundFile, backgroundUrl);
        }

        pageContainer.innerHTML += `${pageData.pageHtmlWrapper}${pageHtml}</div>`;
    }));

    const cssElement = document.createElement('link');
    cssElement.href = `${url}${objectKey}.css${params}`;
    cssElement.as = 'style';
    cssElement.crossOrigin = 'anonymous';
    cssElement.fetchPriority = 'high';
    cssElement.rel = 'preload stylesheet';
    cssElement.type = 'text/css';

    const printWindow = window.open('', '');
    printWindow.document.head.append(cssElement);
    printWindow.document.body.append(pageContainer);
}

function createDownloadButton() {
    if (document.querySelector('.pdf-download-btn')) {
        return;
    }

    const topbar = document.querySelector('div[class^="TopbarActions_secondary-actions-wrapper"]');
    const downloadButtons = topbar.firstChild.cloneNode(true);
    downloadButtons.querySelectorAll('button[aria-label^="Download"]')
        .forEach(downloadButton => {
            downloadButton.classList.add('pdf-download-btn');
            downloadButton.innerText = 'Download as PDF';
            downloadButton.addEventListener('click', fetchDocument);
        });
    topbar.prepend(downloadButtons);
}
new MutationObserver(createDownloadButton).observe(document.body, { childList: true, subtree: true });
