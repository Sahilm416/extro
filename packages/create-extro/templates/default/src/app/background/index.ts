// The background service worker. Runs in the extension's own context with full
// access to the chrome.* APIs. This file is the entrypoint; import freely.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed")
})
