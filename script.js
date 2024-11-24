// Select the landing page and main page
const landingPage = document.getElementById('landing-page');
const mainPage = document.getElementById('main-page');
const startButton = document.getElementById('start-button');

// Initialize Vimeo Player API
const iframe = document.querySelector('iframe');
const player = new Vimeo.Player(iframe);

// Add event listener to "Click Here" button
startButton.addEventListener('click', () => {
    // Hide landing page and show main page
    landingPage.style.display = 'none';
    mainPage.style.display = 'block';

    // Start playing video with sound
    player.setVolume(1).then(() => {
        player.play();
    }).catch((error) => {
        console.error('Error playing video:', error);
    });
});

// Disable right-click context menu
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    alert('Right-click is disabled on this website.');
});

// Disable developer tools shortcuts
document.addEventListener('keydown', (event) => {
    if (
        event.key === 'F12' || // F12
        (event.ctrlKey && event.shiftKey && event.key === 'I') || // Ctrl+Shift+I
        (event.ctrlKey && event.shiftKey && event.key === 'J') || // Ctrl+Shift+J
        (event.ctrlKey && event.key === 'U') // Ctrl+U
    ) {
        event.preventDefault();
        alert('Inspect Element is disabled on this website.');
    }
});
