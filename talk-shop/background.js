chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    const url = new URL(tab.url);
    if (url.protocol !== 'https:' || !['depop.com', 'www.depop.com'].includes(url.hostname)) {
      await chrome.action.setBadgeText({ tabId: tab.id, text: 'Depop' });
      return;
    }
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['details.js', 'categories.js', 'form.js', 'panel.js']
    });
  } catch (error) {
    console.warn('Could not open Depop Voice Draft', error);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' }).catch(() => {});
  }
});
