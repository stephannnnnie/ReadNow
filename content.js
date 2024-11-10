let isEnabled = false;
let isProcessing = false;
let isInitialized = false;

let speechUtterance = null;
let isSpeaking = false;
let currentSpeakingElement = null;
let speechQueue = [];
let isPaused = false;

function createOrUpdateStyles() {
    const oldStyle = document.getElementById('adhd-helper-styles');
    if (oldStyle) {
        oldStyle.remove();
    }

    const newStyle = document.createElement('style');
    newStyle.id = 'adhd-helper-styles';
    newStyle.textContent = `
        html, body{
            background-color: rgba(0, 0, 0, 0.8) !important;
        }
        div, main, article, section, aside, p, span {
            background-color: transparent !important;
            color: rgba(255, 255, 255, 0.3);
        }
        p {
            transition: all 0.3s ease;
            position: relative;
            z-index: 0;
            margin: 1em 0;
            
        }
        .focused-element{
            background-color: white !important;
            padding: 10px !important;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.2) !important;
            transition: all 0.3s ease !important;
            position: relative !important;
            z-index: 1 !important;
        }
        
        .focused-element, 
        .focused-element span,
        .focused-element strong {
            background-color: white !important;
            color: black !important;
        }
        strong {
            background-color: transparent !important;
            color: #000;
            font-weight: 700;
        }
        .enhanced-word {
            display: inline;
        }
    `;
    
    newStyle.textContent += `
        .speaking {
            background-color: #e6ffe6 !important;
            color: black !important;
            transition: all 0.3s ease;
        }
    `;
    document.head.appendChild(newStyle);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to enhance first letters and capitals
function enhanceText(element) {
    // Skip if element is a script or style tag
    if (isProcessing ||
        element.dataset.enhanced ||
        element.tagName === 'SCRIPT' ||
        element.tagName === 'STYLE' ||
        element.tagName === 'STRONG' ||
        element.classList.contains('enhanced-word')) return;

    element.dataset.enhanced = 'true';
    isProcessing = true;

    // Get all text nodes
    const textContainers = element.querySelectorAll('p, div, span, article, section');

    textContainers.forEach(container => {
        if (container.classList.contains('enhanced-word')) return;

        // 递归处理每个文本节点
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (!text.trim()) return;

                const words = text.split(/(\s+)/);
                const fragment = document.createDocumentFragment();

                words.forEach(word => {
                    if (!word.trim()) {
                        fragment.appendChild(document.createTextNode(word));
                        return;
                    }

                    const wordSpan = document.createElement('span');
                    wordSpan.classList.add('enhanced-word');

                    // 处理句子开头的大写字母和单词中的大写字母
                    let enhancedWord = word.replace(
                        /(^[A-Za-z])|([A-Z])/g,
                        (match, sentenceStart, capitalLetter) => {
                            const letter = sentenceStart || capitalLetter;
                            return `<strong>${letter}</strong>`;
                        }
                    );

                    wordSpan.innerHTML = enhancedWord;
                    fragment.appendChild(wordSpan);
                });

                node.parentNode.replaceChild(fragment, node);
            } else if (node.nodeType === Node.ELEMENT_NODE &&
                !node.classList.contains('enhanced-word')) {
                Array.from(node.childNodes).forEach(processNode);
            }
        }

        Array.from(container.childNodes).forEach(processNode);
        container.dataset.textEnhanced = 'true';
    });

    isProcessing = false;
}

function isNearParagraph(element, x, y, threshold = 20) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return x >= (rect.left - threshold) &&
        x <= (rect.right + threshold) &&
        y >= (rect.top - threshold) &&
        y <= (rect.bottom + threshold);
}

function findBestParagraphTarget(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (const element of elements) {
        if (element.tagName === 'P' && isNearParagraph(element, x, y)) {
            return element;
        }
    }
    return null;
}

// Function to handle mouse movement and highlighting
const handleMouseMove = debounce((e) => {
    const currentTarget = findBestParagraphTarget(e.clientX, e.clientY);
    const previousTarget = document.querySelector('.focused-element');

    // Only update if target changed
    if (currentTarget !== previousTarget) {
        if (previousTarget) {
            previousTarget.classList.remove('focused-element');
        }
        if (currentTarget) {
            currentTarget.classList.add('focused-element');
            if (!currentTarget.dataset.textEnhanced) {
                enhanceText(currentTarget);
            }
        }
    }
}, 40);
document.addEventListener('mousemove', handleMouseMove);
// document.head.appendChild(styles);

// Initialize the extension
function initializeExtension() {
    console.log('ADHD Helper initialized');

    // Enhance all text on the page
    chrome.storage.local.get(['enabled'], (result) => {
        isEnabled = result.enabled || false;

        if (isEnabled) {
            createOrUpdateStyles();
            document.addEventListener('mousemove', handleMouseMove);
            enhanceText(document.body);

            // Add mouse move listener for focus effect


            // Handle dynamically added content
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            enhanceText(node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'toggleHelper') {
            isEnabled = message.enabled;
            if (isEnabled) {
                createOrUpdateStyles();
                document.addEventListener('mousemove', handleMouseMove);
                enhanceText(document.body);
            } else {
                const styleEl = document.getElementById('adhd-helper-styles');
                if (styleEl) styleEl.remove();
                document.removeEventListener('mousemove', handleMouseMove);
                document.querySelectorAll('.focused-element')
                    .forEach(el => el.classList.remove('focused-element'));
            }
        }
        if (message.action === 'startSpeech') {
            startSpeaking();
        } else if (message.action === 'pauseSpeech') {
            pauseSpeaking();
        } else if (message.action === 'stopSpeech') {
            stopSpeaking();
        }
    });

    isInitialized = true;
    console.log('ADHD Helper initialized');
}

function initializeSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
        console.error('Text-to-speech is not supported in this browser');
        return false;
    }
    return true;
}

function getPreferredVoice() {
    const voices = speechSynthesis.getVoices();
    // Prefer native voices over remote ones
    return voices.find(voice => !voice.remote) || voices[0];
}

// function startSpeaking() {
//     if (isSpeaking) return;
    
//     // Get all paragraphs
//     const paragraphs = document.querySelectorAll('p');
//     let currentIndex = 0;

//     function speakNext() {
//         if (currentIndex >= paragraphs.length) {
//             isSpeaking = false;
//             return;
//         }

//         const paragraph = paragraphs[currentIndex];
        
//         // Remove previous highlight
//         if (currentSpeakingElement) {
//             currentSpeakingElement.classList.remove('speaking');
//         }
        
//         // Highlight current paragraph
//         paragraph.classList.add('speaking');
//         currentSpeakingElement = paragraph;

//         // Create speech utterance
//         speechUtterance = new SpeechSynthesisUtterance(paragraph.textContent);
        
//         // Configure speech
//         speechUtterance.rate = 1.0; // 语速
//         speechUtterance.pitch = 1.0; // 音高
//         speechUtterance.volume = 1.0; // 音量
        
//         // Handle speech events
//         speechUtterance.onend = () => {
//             paragraph.classList.remove('speaking');
//             currentIndex++;
//             speakNext();
//         };

//         speechUtterance.onboundary = (event) => {
//             // Word boundary event for more precise highlighting
//             if (event.name === 'word') {
//                 // Could implement word-level highlighting here
//             }
//         };

//         // Start speaking
//         window.speechSynthesis.speak(speechUtterance);
//     }

//     isSpeaking = true;
//     speakNext();
// }

function startSpeaking() {
    if (!initializeSpeechSynthesis()) return;
    
    if (isSpeaking && !isPaused) return;
    
    // Cancel any existing speech
    stopSpeaking();
    
    // Get all paragraphs
    const paragraphs = document.querySelectorAll('p');
    speechQueue = Array.from(paragraphs);
    
    if (speechQueue.length === 0) {
        console.log('No text content found to read');
        return;
    }
    
    isSpeaking = true;
    isPaused = false;
    speakNext();
}

function speakNext() {
    if (!isSpeaking || speechQueue.length === 0) {
        finishSpeaking();
        return;
    }

    const paragraph = speechQueue.shift();
    
    // Remove previous highlight
    if (currentSpeakingElement) {
        currentSpeakingElement.classList.remove('speaking');
    }
    
    // Highlight current paragraph
    paragraph.classList.add('speaking');
    currentSpeakingElement = paragraph;

    // Scroll paragraph into view
    paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Create speech utterance
    speechUtterance = new SpeechSynthesisUtterance(paragraph.textContent);
    
    // Wait for voices to be loaded
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
            configureUtterance(speechUtterance);
        }, { once: true });
    } else {
        configureUtterance(speechUtterance);
    }
    
    // Handle speech events
    setupSpeechEvents(speechUtterance, paragraph);
    
    try {
        window.speechSynthesis.speak(speechUtterance);
    } catch (error) {
        console.error('Error speaking:', error);
        // Try to recover by moving to next paragraph
        speakNext();
    }
}

function configureUtterance(utterance) {
    utterance.voice = getPreferredVoice();
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // Optionally get these values from user settings
    // chrome.storage.local.get(['speechRate', 'speechPitch', 'speechVolume'], 
    //     (settings) => {
    //         utterance.rate = settings.speechRate || 1.0;
    //         utterance.pitch = settings.speechPitch || 1.0;
    //         utterance.volume = settings.speechVolume || 1.0;
    // });
}

function setupSpeechEvents(utterance, paragraph) {
    utterance.onend = () => {
        paragraph.classList.remove('speaking');
        speakNext();
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        paragraph.classList.remove('speaking');
        speakNext();
    };

    utterance.onpause = () => {
        isPaused = true;
    };

    utterance.onresume = () => {
        isPaused = false;
    };

    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            // Could implement word-level highlighting here
            // const wordStart = event.charIndex;
            // const wordLength = event.charLength || 1;
            // highlightWord(paragraph, wordStart, wordLength);
        }
    };
}

function pauseSpeaking() {
    if (!isSpeaking || isPaused) return;
    window.speechSynthesis.pause();
    isPaused = true;
}

function resumeSpeaking() {
    if (!isSpeaking || !isPaused) return;
    window.speechSynthesis.resume();
    isPaused = false;
}

function stopSpeaking() {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    isPaused = false;
    speechQueue = [];
    
    if (currentSpeakingElement) {
        currentSpeakingElement.classList.remove('speaking');
        currentSpeakingElement = null;
    }
}

function finishSpeaking() {
    isSpeaking = false;
    isPaused = false;
    speechQueue = [];
    
    if (currentSpeakingElement) {
        currentSpeakingElement.classList.remove('speaking');
        currentSpeakingElement = null;
    }
}

// Initialize when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}