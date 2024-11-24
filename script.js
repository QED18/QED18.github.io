const video = document.getElementById('background-video');
const muteToggle = document.getElementById('mute-toggle');
const volumeDown = document.getElementById('volume-down');
const volumeUp = document.getElementById('volume-up');

// Mute/Unmute Video
muteToggle.addEventListener('click', () => {
    video.muted = !video.muted;
    muteToggle.textContent = video.muted ? 'Unmute' : 'Mute';
});

// Decrease Volume
volumeDown.addEventListener('click', () => {
    if (video.volume > 0) {
        video.volume = Math.max(0, video.volume - 0.1); // Decrease by 10%
    }
});

// Increase Volume
volumeUp.addEventListener('click', () => {
    if (video.volume < 1) {
        video.volume = Math.min(1, video.volume + 0.1); // Increase by 10%
    }
});

// Disable Right-Click Context Menu
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    alert('Right-click is disabled on this website.');
});

// Disable F12 and Ctrl+Shift+I (Inspect Element)
document.addEventListener('keydown', (event) => {
    if (
        event.key === 'F12' || // F12 key
        (event.ctrlKey && event.shiftKey && event.key === 'I') || // Ctrl+Shift+I
        (event.ctrlKey && event.shiftKey && event.key === 'J') || // Ctrl+Shift+J (Console)
        (event.ctrlKey && event.key === 'U') // Ctrl+U (View Source)
    ) {
        event.preventDefault();
        alert('Inspecting elements is disabled.');
    }
});
