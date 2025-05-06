// Initialize the map. Set View to Moscow
const map = L.map('map').setView([55.751244, 37.618423], 15);
// Attribution in the right bottom corner.
map.attributionControl.setPrefix('<a href="https://openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>');
// Loading tiles.
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 4,
    maxZoom: 19
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let selectedCoordinates = null;

// Initialize Toast notifications
const successToast = new bootstrap.Toast(document.getElementById('successToast'), { delay: 3000 });
const mapClickToast = new bootstrap.Toast(document.getElementById('mapClickToast'), { delay: 5000 });

// Determine marker color based on signal quality
// Generate gradient color: red (0) → yellow (5) → green (10)
function getSignalColor(signal) {
    const ratio = Math.min(Math.max(signal, 0), 10) / 10; // Normalize 0–10 to 0–1

    let r, g, b;
    if (ratio <= 0.5) {
        // From red (#FF0000) to yellow (#FFFF00)
        const subRatio = ratio * 2; // Scale 0–0.5 to 0–1
        r = 255;
        g = Math.round(255 * subRatio); // Green increases from 0 to 255
        b = 0;
    } else {
        // From yellow (#FFFF00) to green (#00FF00)
        const subRatio = (ratio - 0.5) * 2; // Scale 0.5–1 to 0–1
        r = Math.round(255 * (1 - subRatio)); // Red decreases from 255 to 0
        g = 255;
        b = 0;
    }

    // Convert to HEX
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Load and display devices
function updateMarkers(devices) {
    markersLayer.clearLayers();
    const radius = 30; // 30 meters radius of the circle
    // Binging popups and adding dots to the map.
    devices.forEach(device => {
        const marker = L.circle([device.coordinate_y, device.coordinate_x], {
            radius: radius,
            color: getSignalColor(device.signal_quality),
            fillColor: getSignalColor(device.signal_quality),
            fillOpacity: 0.7,
            interactive: true
        }).bindPopup(`
            <b>${device.device_id}</b>
            <div class="signal-${device.signal_quality > 7 ? 'high' :
            device.signal_quality > 3 ? 'medium' : 'low'}">
                Signal quality: ${device.signal_quality}/10
            </div>
            <div>Coordinates:
                ${Number(device.coordinate_x).toFixed(6)},
                ${Number(device.coordinate_y).toFixed(6)}
            </div>
            <div>Coverage: 30m radius</div>
        `);
        markersLayer.addLayer(marker);
    });
}

// Load devices from the server
function loadDevices() {
    fetch('http://localhost:8080/api/devices')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(updateMarkers)
        .catch(error => {
            console.error('Error:', error);
            // Display error via Toast
            const errorToast = new bootstrap.Toast(
                Object.assign(document.createElement('div'), {
                    className: 'toast align-items-center text-bg-danger border-0',
                    role: 'alert',
                    innerHTML: `
                        <div class="d-flex">
                            <div class="toast-body">Failed to load devices</div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>`
                }),
                { delay: 1000 }
            );
            document.querySelector('.toast-container').appendChild(errorToast._element);
            errorToast.show();
        });
}

// Show the device addition form
function showAddForm() {
    const modal = new bootstrap.Modal('#addModal');
    selectedCoordinates = null;

    mapClickToast.show();

    map.once('click', e => {
        selectedCoordinates = e.latlng;
        document.querySelector('[name="coordinate_x"]').value = e.latlng.lng.toFixed(6);
        document.querySelector('[name="coordinate_y"]').value = e.latlng.lat.toFixed(6);
        mapClickToast.hide();
        modal.show();
    });
}

// Escape HTML characters (similar to htmlspecialchars)
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

// Save a new device
function saveDevice() {
    // Retrieve form data from the device addition form
    const formData = new FormData(document.getElementById('deviceForm'));

    // Construct the device data object from form inputs
    const data = {
        device_id: escapeHtml(formData.get('device_id')), // Escape device ID to prevent XSS attacks
        coordinate_x: parseFloat(formData.get('coordinate_x')),
        coordinate_y: parseFloat(formData.get('coordinate_y')),
        signal_quality: parseInt(formData.get('signal_quality'), 10)
    };

    // Validate that coordinates are provided and valid
    if (!data.coordinate_x || !data.coordinate_y) {
        // Create a toast notification for invalid coordinates
        const errorToast = new bootstrap.Toast(
            Object.assign(document.createElement('div'), {
                className: 'toast align-items-center text-bg-danger border-0',
                role: 'alert',
                innerHTML: `
                    <div class="d-flex">
                        <div class="toast-body">Please select coordinates by clicking on the map.</div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>`
            }),
            { delay: 1000 } // Toast disappears after 1 second
        );
        // Append the toast to the toast container and display it
        document.querySelector('.toast-container').appendChild(errorToast._element);
        errorToast.show();
        return; // Exit the function if coordinates are invalid
    }

    // Send a POST request to the server to save the new device
    fetch('http://localhost:8080/api/devices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' // Specify JSON content type
        },
        body: JSON.stringify(data) // Convert data object to JSON string
    })
        .then(response => {
            // Check if the response is successful
            if (response.ok) return response.json(); // Parse and return JSON data if successful
            // Handle errors by parsing the error response and throwing an exception
            return response.json().then(err => {
                throw new Error(err.errors?.join(', ') || 'Server error');
            });
        })
        .then(() => {
            // On success, reload devices to update the map
            loadDevices();
            // Hide the device addition modal
            bootstrap.Modal.getInstance('#addModal').hide();
            // Show a success toast notification
            successToast.show();
        })
        .catch(error => {
            // Log the error to the console for debugging
            console.error('Error:', error);
            // Create a toast notification for the error
            const errorToast = new bootstrap.Toast(
                Object.assign(document.createElement('div'), {
                    className: 'toast align-items-center text-bg-danger border-0',
                    role: 'alert',
                    innerHTML: `
                        <div class="d-flex">
                            <div class="toast-body">Error: ${error.message}</div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>`
                })
            );
            // Append the error toast to the toast container and display it
            document.querySelector('.toast-container').appendChild(errorToast._element);
            errorToast.show();
        });
}
// Initialization
loadDevices();