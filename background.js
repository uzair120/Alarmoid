chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) {
    return;
  }

  openDemoTab();
});

function openDemoTab() {
  chrome.tabs.create({ url: "index.html" });
}

chrome.action.onClicked.addListener(openDemoTab);
