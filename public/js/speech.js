// Initialize speech synthesis
const speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

function speakText(text) {
    // Stop any currently playing speech
    if (currentUtterance) {
        speechSynthesis.cancel();
    }

    // Create new utterance
    currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Set voice properties
    currentUtterance.lang = 'vi-VN'; // Vietnamese language
    currentUtterance.rate = 0.9; // Slightly slower for better comprehension
    currentUtterance.pitch = 1;
    currentUtterance.volume = 1;

    // Try to find a Vietnamese voice
    const voices = speechSynthesis.getVoices();
    const vietnameseVoice = voices.find(voice => 
        voice.lang.includes('vi') || voice.lang.includes('VN')
    );
    
    if (vietnameseVoice) {
        currentUtterance.voice = vietnameseVoice;
    }

    // Event handlers
    currentUtterance.onstart = () => {
        console.log('Speech started');
    };

    currentUtterance.onend = () => {
        console.log('Speech ended');
        currentUtterance = null;
    };

    currentUtterance.onerror = (event) => {
        console.error('Speech error:', event.error);
        currentUtterance = null;
    };

    // Speak the text
    speechSynthesis.speak(currentUtterance);
}

// Function to stop current speech
function stopSpeech() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        currentUtterance = null;
    }
}

// Load voices when they become available
speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
};

// Make functions globally available
window.speakText = speakText;
window.stopSpeech = stopSpeech;
