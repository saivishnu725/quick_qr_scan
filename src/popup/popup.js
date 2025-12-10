console.log('Popup script loaded');

let count = 0;
document.getElementById('testBtn').addEventListener('click', () => {
    const status = document.getElementById('status');
    status.textContent = 'Button clicked ' + (++count) + ' times';
});