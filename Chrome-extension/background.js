let profiloUtente = undefined;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	//console.log(sender.tab ? "from a content script:" + sender.tab.url : "from the extension");
	//console.log("runtime", request.message);

	if (request.message === "is_first_load") {
		if (request.profiloUtente === profiloUtente) {
			sendResponse({ message: false });
		} else {
			sendResponse({ message: true });
		}
	};

	if (request.message === "done_loading") {
		profiloUtente = request.profiloUtente;
	};
});
