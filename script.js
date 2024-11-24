// Select the landing page and main page
const landingPage = document.getElementById('landing-page');
const mainPage = document.getElementById('main-page');
const startButton = document.getElementById('start-button');

// Add event listener to the "Click Here" button
startButton.addEventListener('click', () => {
    // Hide the landing page
    landingPage.style.display = 'none';
    // Show the main page
    mainPage.style.display = 'block';
});

// Disable Right-Click Context Menu
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    alert('Right-click is disabled on this website.');
});

// Disable Keyboard Shortcuts for Developer Tools
document.addEventListener('keydown', (event) => {
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

// Vimeo Player Controls (If Vimeo Player API is needed)
const iframe = document.querySelector('iframe');
const player = new Vimeo.Player(iframe);

// Example: Start autoplay when the main page is shown
player.on('loaded', () => {
    player.play().catch((error) => {
        console.error('Error starting playback:', error);
    });
});

// Example: Log events (optional)
player.on('play', () => {
    console.log('Video is playing');
});
player.on('pause', () => {
    console.log('Video is paused');
});
