// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('enableReading');
    const playButton = document.getElementById('playButton');
    const pauseButton = document.getElementById('pauseButton');
    const stopButton = document.getElementById('stopButton');
    
    // Load saved state
    chrome.storage.local.get(['enabled'], (result) => {
        checkbox.checked = result.enabled || false;
    });
    
    // Save state changes
    checkbox.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        chrome.storage.local.set({ enabled });
        
        // Notify content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'toggleHelper',
                enabled 
            });
        });
    });

    playButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'startSpeech' });
        });
    });

    pauseButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'pauseSpeech' });
        });
    });

    stopButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'stopSpeech' });
        });
    });
});