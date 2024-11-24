// Disable Right-Click Context Menu
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    alert('Right-click is disabled on this website.');
});

// Disable Keyboard Shortcuts for Developer Tools
document.addEventListener('keydown', (event) => {
    // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (
        event.key === 'F12' || // F12
        (event.ctrlKey && event.shiftKey && event.key === 'I') || // Ctrl+Shift+I
        (event.ctrlKey && event.shiftKey && event.key === 'J') || // Ctrl+Shift+J
        (event.ctrlKey && event.key === 'U') // Ctrl+U (View Source)
    ) {
        event.preventDefault();
        alert('Inspect Element is disabled on this website.');
    }
});

// Vimeo Player Controls (Your Volume and Mute Logic)
const iframe = document.querySelector('iframe');
const player = new Vimeo.Player(iframe);
const volumeSlider = document.getElementById('volume-slider');
const muteToggle = document.getElementById('mute-toggle');
let isMuted = false;

// Handle Volume Slider Changes
volumeSlider.addEventListener('input', (event) => {
    const volume = event.target.value / 100;
    player.setVolume(volume).then(() => {
        if (volume > 0) {
            isMuted = false;
            muteToggle.textContent = 'Mute';
        }
    }).catch((error) => {
        console.error('Error setting volume:', error);
    });
});

// Handle Mute/Unmute Button
muteToggle.addEventListener('click', () => {
    if (isMuted) {
        const volume = volumeSlider.value / 100;
        player.setVolume(volume).then(() => {
            muteToggle.textContent = 'Mute';
            isMuted = false;
        }).catch((error) => {
            console.error('Error unmuting:', error);
        });
    } else {
        player.setVolume(0).then(() => {
            muteToggle.textContent = 'Unmute';
            isMuted = true;
        }).catch((error) => {
            console.error('Error muting:', error);
        });
    }
});
