async function fetchDocument() {
    const { documentAccess, pageDataList } = JSON.parse(__NEXT_DATA__.innerText).props.pageProps;
    const { url, objectKey, signedQueryParams } = documentAccess;
    const params = signedQueryParams.global;

    const pageContainer = document.createElement('div');
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

    const styleElement = document.createElement('style');
    styleElement.textContent = `
body > *:not(.p2hv) { 
    display: none !important; 
}

@media print {
    @page {
        margin: 0;
        size: A4;
    }
    body {
        margin: 0;
    }
    #page-container {
        transform: scale(2);
        transform-origin: top left;
    }
    #page-container .pf {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        break-after: always;
        border: none;
    }
}
`;
    document.head.append(styleElement);

    const viewerElement = document.createElement('div');
    viewerElement.classList.add('p2hv');
    viewerElement.append(pageContainer);

    document.body.append(viewerElement);
    window.print();
    styleElement.remove();
    viewerElement.remove();
}

function createDownloadButton() {
    if (document.querySelector('.pdf-download-btn')) {
        return;
    }

    const topbar = document.querySelector('div[class^="TopbarActions_secondary-actions-wrapper"]');
    const downloadButtons = topbar?.firstChild?.cloneNode(true);
    if (!downloadButtons) {
        return;
    }

    downloadButtons.querySelectorAll('button[aria-label^="Download"]')
        .forEach(downloadButton => {
            downloadButton.classList.add('pdf-download-btn');
            downloadButton.innerText = 'Download as PDF';
            downloadButton.addEventListener('click', fetchDocument);
        });
    topbar.prepend(downloadButtons);
}
window.addEventListener('load', () => {
    const observer = new MutationObserver(createDownloadButton);
    observer.observe(document.body, { childList: true, subtree: true });
});
