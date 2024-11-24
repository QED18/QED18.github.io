// Select the landing page, main page, and start button
const landingPage = document.getElementById('landing-page');
const mainPage = document.getElementById('main-page');
const startButton = document.getElementById('start-button');

// Add event listener to the "Click Here" button
startButton.addEventListener('click', () => {
    // Hide landing page and show main page
    landingPage.style.display = 'none';
    mainPage.style.display = 'block';

    // Request fullscreen mode
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) { // For Safari
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { // For IE11
        document.documentElement.msRequestFullscreen();
    }
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

