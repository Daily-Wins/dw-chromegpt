// Ladda sparade inställningar
chrome.storage.local.get(['apiKey', 'assistantId', 'excludedUrls'], (result) => {
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
  if (result.assistantId) {
    document.getElementById('assistantId').value = result.assistantId;
  }
  if (result.excludedUrls) {
    renderExcludedList(result.excludedUrls);
  }
});

// Spara inställningar
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const assistantId = document.getElementById('assistantId').value;

  if (!apiKey || !assistantId) {
    showStatus('Vänligen fyll i alla fält', 'error');
    return;
  }

  chrome.storage.local.set({ apiKey, assistantId }, () => {
    showStatus('✓ Sparat!', 'success');
  });
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => status.textContent = '', 3000);
}

// ============================================
// EXCLUSION LIST MANAGEMENT
// ============================================

/**
 * Render the list of excluded URLs/domains
 */
function renderExcludedList(excludedUrls) {
  const container = document.getElementById('excludedList');

  if (!excludedUrls || excludedUrls.length === 0) {
    container.innerHTML = '<div class="empty-state">Inga exkluderade webbplatser</div>';
    return;
  }

  container.innerHTML = excludedUrls.map(url => `
    <div class="excluded-item">
      <span>${url}</span>
      <button data-url="${url}">Ta bort</button>
    </div>
  `).join('');

  // Add click handlers to remove buttons
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const urlToRemove = btn.getAttribute('data-url');
      removeFromExclusionList(urlToRemove);
    });
  });
}

/**
 * Remove URL/domain from exclusion list
 */
function removeFromExclusionList(urlToRemove) {
  chrome.storage.local.get(['excludedUrls'], (result) => {
    let excludedUrls = result.excludedUrls || [];
    excludedUrls = excludedUrls.filter(url => url !== urlToRemove);

    chrome.storage.local.set({ excludedUrls }, () => {
      renderExcludedList(excludedUrls);
      showStatus(`✓ ${urlToRemove} borttagen`, 'success');
    });
  });
}

// Listen for storage changes to update the list in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.excludedUrls) {
    renderExcludedList(changes.excludedUrls.newValue);
  }
});
