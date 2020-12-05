let profiloUtente;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'is_first_load') {
    if (request.profiloUtente === profiloUtente) {
      sendResponse({ message: false });
    } else {
      sendResponse({ message: true });
    }
  }

  if (request.message === 'done_loading') {
    profiloUtente = request.profiloUtente;
  }
});
