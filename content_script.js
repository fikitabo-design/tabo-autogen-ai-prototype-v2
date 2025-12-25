
/**
 * Content script to interact with stock contributor pages.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_page_image") {
    // Dreamstime specific
    const dtImage = document.getElementById('image-item');
    if (dtImage && dtImage.src) {
      sendResponse({ url: dtImage.src, site: 'Dreamstime' });
      return;
    }

    // Adobe Stock specific
    const adobeThumb = document.querySelector('img.upload-tile__thumbnail');
    if (adobeThumb && adobeThumb.src) {
      sendResponse({ url: adobeThumb.src, site: 'Adobe Stock' });
      return;
    }

    // Generic fallback
    const firstLargeImg = Array.from(document.querySelectorAll('img')).find(img => img.width > 300);
    if (firstLargeImg) {
      sendResponse({ url: firstLargeImg.src, site: 'Generic' });
    } else {
      sendResponse({ error: "No suitable image found on page" });
    }
  }

  if (request.action === "fill_form") {
    const { metadata, platform } = request;
    
    try {
      if (platform === 'Dreamstime') {
        const title = document.querySelector('#title');
        const desc = document.querySelector('#description');
        const keywords = document.querySelector('#keywords_tag');
        
        if (title) title.value = metadata.title;
        if (desc) desc.value = metadata.description;
        if (keywords) keywords.value = metadata.keywords;
        
        sendResponse({ success: true });
      } else {
        // Simple Generic Fill
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          const label = input.getAttribute('placeholder')?.toLowerCase() || "";
          if (label.includes('title')) input.value = metadata.title;
          if (label.includes('description')) input.value = metadata.description;
          if (label.includes('keyword') || label.includes('tag')) input.value = metadata.keywords;
        });
        sendResponse({ success: true });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
  }
  return true;
});
