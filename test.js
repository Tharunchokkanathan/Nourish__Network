const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('dashboard.html', 'utf-8');

const dom = new JSDOM(html, {
  url: "http://localhost/dashboard.html",
  runScripts: "dangerously",
  resources: "usable"
});

dom.window.localStorage.setItem('nourishUser', JSON.stringify({ type: 'vendor', name: 'Test' }));

// Catch any errors inside the jsdom window
dom.window.addEventListener("error", event => {
  console.error("Window Error:", event.error);
});

// Load dashboard.js
const script = fs.readFileSync('dashboard.js', 'utf-8');
const scriptEl = dom.window.document.createElement('script');
scriptEl.textContent = script;
dom.window.document.body.appendChild(scriptEl);

// Fire DOMContentLoaded
const event = dom.window.document.createEvent('Event');
event.initEvent('DOMContentLoaded', true, true);
dom.window.document.dispatchEvent(event);

// Wait for DOMContentLoaded to fire
setTimeout(() => {
    console.log("Feed HTML length:", dom.window.document.getElementById('listingsFeed').innerHTML.length);
    console.log("Sweets Feed HTML length:", dom.window.document.getElementById('sweetsFeed').innerHTML.length);
    console.log("Test finished.");
}, 2000);
