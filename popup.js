// Ladda sparade inställningar
chrome.storage.local.get(['apiKey', 'assistantId'], (result) => {
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey;
  }
  if (result.assistantId) {
    document.getElementById('assistantId').value = result.assistantId;
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
