MixedContentMonitor.patterns = {
  scriptPattern: new RegExp("\.js$", "i"),
  imagePattern: new RegExp("(\.jpeg|\.jpg|\.tiff|\.png|\.gif|\.bmp)$", "i"),
  cssPattern: new RegExp("\.css$", "i"),
  htmlPattern: new RegExp("(\.htm|\.html)$", "i"),
  patternStringLength: 7, 
  searchPattern: function(uri) {
	if (this.scriptPattern.test(uri)) return "SCRIPT ";
	if (this.imagePattern.test(uri)) return "IMG    ";
	if (this.cssPattern.test(uri)) return "CSS    ";
	if (this.htmlPattern.test(uri)) return "HTML   ";
	return "OTHER  ";
  }
};

MixedContentMonitor.notify = {

  QueryInterface: function(aIID)
  {
	if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
		aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
		aIID.equals(Components.interfaces.nsISupports))
		return this;
	throw Components.results.NS_NOINTERFACE;
  },

  init: function() {
	  let allBrowsers = window.opener.gBrowser.browsers;
	  let i = 0;
	  for (i = 0; i < allBrowsers.length; i++) {
		let webProgress = allBrowsers[i].webProgress;
		webProgress.addProgressListener(this, webProgress.NOTIFY_LOCATION | webProgress.NOTIFY_STATE_REQUEST);
	  }

	  window.opener.gBrowser.tabContainer.addEventListener("TabOpen", this, false);
	  window.opener.gBrowser.tabContainer.addEventListener("TabClose", this, false);
  }, 

  uninit : function() {
      window.opener.gBrowser.browsers.forEach(function(browser) {
		browser.webProgress.removeProgressListener(this);
	  }, this);

	  window.opener.gBrowser.tabContainer.removeEventListener("TabOpen", this, false);
	  window.opener.gBrowser.tabContainer.removeEventListener("TabClose", this, false);
  },

  handleEvent: function(aEvent) {
    let tab = aEvent.target;
	let webProgress = window.opener.gBrowser.getBrowserForTab(tab).webProgress;

	if (aEvent.type === "TabOpen") {
	  webProgress.addProgressListener(this, webProgress.NOTIFY_LOCATION | webProgress.NOTIFY_STATE_REQUEST);
	} else {
	  webProgress.removeProgressListener(this);
	  // also remove the vbox from the sidebar
	  let util = webProgress.DOMWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
	  let windowID = util.outerWindowID;
	  let listbox = document.getElementById(windowID);
	  if (listbox != null) {
		while (listbox.hasChildNodes()) {
		  listbox.removeChild(listbox.firstChild);
		}
		listbox.parentNode.removeChild(listbox);
	  }
	}
  }, 

  onLocationChange: function(aProgress, aRequest, aURI) {
	// remove the current listbox from the mixedcontent list since the url
	// has changed
	let util = aProgress.DOMWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
	let windowID = util.outerWindowID;
	let listbox = document.getElementById(windowID);
	if (listbox != null) {
	  while (listbox.hasChildNodes()) {
		listbox.removeChild(listbox.firstChild);
	  }
	  listbox.parentNode.removeChild(listbox);
	}
  }, 

  onStateChange: function(aProgress, aRequest, aStateFlags, aStatus) {

	if ((aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START) == 0 &&
	  (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_REDIRECTING) == 0 ) return;

	let parentURL = aProgress.DOMWindow.document.URL;
	if (parentURL == null) return;
	let parentColon = parentURL.indexOf(':');
	if (parentColon == -1 || parentURL.substring(0, parentColon) != "https") return;

	let uri = aRequest.name;
	let colon = uri.indexOf(':');
	if (colon == -1 || uri.substring(0, colon) != "http") return;

	// FIXME: shouldn't do this because the request might not end with js
	// or css while it is still a mixed content request.
	// cancel the request if the mixed content is a js or css
	// Wait until the response back and see what its type is?
	if (MixedContentMonitor.patterns.scriptPattern.test(uri) || 
		MixedContentMonitor.patterns.cssPattern.test(uri)) {
	  aRequest.cancel(Components.results.NS_BINDING_ABORTED);
	}

	// show the notification into the sidebar
	let util = aProgress.DOMWindow.top.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);
	let windowID = util.outerWindowID;

	// for the first mixed content, create the parent window's vbox first
	if (document.getElementById(windowID) == null) {
	  let listbox = document.createElement("listbox");
	  listbox.setAttribute("id", windowID);
	  listbox.setAttribute("flex", "1");
	  document.getElementById("vulnlist").appendChild(listbox);
	  // create the title for the entry as well
	  let newEntry = document.createElement("listitem");
	  newEntry.setAttribute("label", "Tab: " + aProgress.DOMWindow.document.URL);
	  newEntry.setAttribute("value", "Tab: " + aProgress.DOMWindow.document.URL);
	  newEntry.setAttribute("style", "font-weight:bold");
	  listbox.appendChild(newEntry);
	}

	// check for duplicates in the list, and if not, add a new entry to it.
	// The reason for duplicates to occur is that some requests are fired
	// more than one time if the first one get dropped by us. 
	let listbox = document.getElementById(windowID);
	let kids = listbox.childNodes;
	let i = 1;
	for (i = 1; i < kids.length; i++) {
	  if (kids[i].label.substring(MixedContentMonitor.patterns.patternStringLength) == aRequest.name) break;
	}
	if (i == kids.length) {
	  document.getElementById(windowID).appendItem(
		  MixedContentMonitor.patterns.searchPattern(aRequest.name) + aRequest.name, 
		  MixedContentMonitor.patterns.searchPattern(aRequest.name) + aRequest.name);
	}
  }, 

};

MixedContentMonitor.notify.init();
