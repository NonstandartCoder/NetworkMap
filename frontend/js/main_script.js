const map = L.map('map', {
    renderer: L.canvas()
}).setView([55.751244, 37.618423], 15); // Moscow coordinates

// Configure map attribution
map.attributionControl.setPrefix('<a href="https://openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>');

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19 // Maximum zoom level for the tiles
}).addTo(map);

// Configure marker clustering with custom settings
const markersLayer = L.markerClusterGroup({
    maxClusterRadius: 100, // Pixels from cluster center to include markers
    disableClusteringAtZoom: 18, // Disable clustering at this zoom level
    spiderfyOnMaxZoom: false, // Don't spiderfy when reaching max zoom
    chunkedLoading: true, // Split processing into chunks for better performance

    // Custom cluster icon creation based on average signal quality
    iconCreateFunction: function(cluster) {
        const markers = cluster.getAllChildMarkers();
        let totalSignal = 0;

        // Calculate average signal quality from all child markers
        markers.forEach(marker => {
            totalSignal += marker.options.deviceData.signal_quality;
        });
        const avgSignal = markers.length > 0 ? totalSignal / markers.length : 0;
        const color = getSignalColor(avgSignal);

        // Create cluster div icon with dynamic color and marker count
        return L.divIcon({
            className: 'signal-cluster',
            iconSize: [40, 40],
            html: `
                <div style="
                    background: ${color};
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 2px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    color: white;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                ">
                    ${markers.length}
                </div>
            `
        });
    }
}).addTo(map);

// Application state variables
let selectedCoordinates = null; // Stores map click coordinates
let devicesCache = []; // Local cache of devices

// Initialize toast notifications
const successToast = new bootstrap.Toast(document.getElementById('successToast'), { delay: 3000 });
const mapClickToast = new bootstrap.Toast(document.getElementById('mapClickToast'), { delay: 5000 });

/**
 * Generates color gradient from red to yellow to green based on signal quality
 * @param {number} signal - Signal quality value (0-10)
 * @returns {string} HEX color code
 */
function getSignalColor(signal) {
    // Normalize signal value to be between 0 and 1 (0-10 → 0-1)
    const ratio = Math.min(Math.max(signal, 0), 10) / 10;
    let r, g, b;

    // For lower half of signal quality (0-5), transition from red to yellow
    if (ratio <= 0.5) {
        const subRatio = ratio * 2; // Scale to 0-1 range
        r = 255; // Keep red at max
        g = Math.round(255 * subRatio); // Increase green
        b = 0; // No blue
    }
    // For upper half (5-10), transition from yellow to green
    else {
        const subRatio = (ratio - 0.5) * 2; // Scale to 0-1 range
        r = Math.round(255 * (1 - subRatio)); // Decrease red
        g = 255; // Keep green at max
        b = 0; // No blue
    }
    // Convert RGB values to HEX string
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Creates a Leaflet marker with custom styling and device data
 * @param {Object} device - Device data object
 * @returns {L.Marker} Configured Leaflet marker
 */
function createMarker(device) {
    // Get color based on signal quality
    const color = getSignalColor(device.signal_quality);

    // Create custom div icon for the marker
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background: ${color};
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24]
    });

    // Create and return marker with popup content
    return L.marker([device.coordinate_y, device.coordinate_x], {
        icon,
        deviceData: device // Store device data in marker for later access
    }).bindPopup(`
            <b>${device.device_id}</b>
            <div class="signal-${device.signal_quality > 7 ? 'high' :
        device.signal_quality > 3 ? 'medium' : 'low'}">
                Signal: ${device.signal_quality}/10
            </div>
            <div>
                Coordinates:<br>
                ${Number(device.coordinate_x).toFixed(6)},<br>
                ${Number(device.coordinate_y).toFixed(6)}
            </div>
            <div>Coverage: 30m radius</div>
        `);
}

/**
 * Updates map markers in batches for better performance
 * @param {Array} devices - Array of device objects
 */
function updateMarkers(devices) {
    // Clear existing markers
    markersLayer.clearLayers();
    // Update cache with new devices
    devicesCache = devices;

    // Process markers in batches to prevent UI freezing
    const batchSize = 1000;
    let index = 0;

    function addBatch() {
        // Get current batch of devices
        const batch = devices.slice(index, index + batchSize);
        // Add each device in batch as a marker
        batch.forEach(device => {
            markersLayer.addLayer(createMarker(device));
        });
        index += batchSize;
        // If more devices remain, schedule next batch
        if (index < devices.length) setTimeout(addBatch, 50);
    }

    // Start batch processing
    addBatch();
}

/**
 * Fetches devices from server and updates the map
 */
function loadDevices() {
    fetch('http://localhost:8080/api/devices')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(updateMarkers)
        .catch(error => {
            console.error('Error:', error);
            showErrorToast('Failed to load devices');
        });
}

/**
 * Shows device add form and handles map click for coordinates
 */
function showAddForm() {
    const modal = new bootstrap.Modal('#addModal');
    selectedCoordinates = null;
    mapClickToast.show();

    // Set up one-time click listener for coordinate selection
    map.once('click', e => {
        selectedCoordinates = e.latlng;
        // Fill form fields with clicked coordinates
        document.querySelector('[name="coordinate_x"]').value = e.latlng.lng.toFixed(6);
        document.querySelector('[name="coordinate_y"]').value = e.latlng.lat.toFixed(6);
        mapClickToast.hide();
        modal.show();
    });
}

/**
 * Saves new device to server and updates UI
 * @param {HTMLElement} button - The save button element
 */
function saveDevice(button) {
    const form = document.getElementById('deviceForm');
    const formData = new FormData(form);
    const data = {
        device_id: escapeHtml(formData.get('device_id')),
        coordinate_x: parseFloat(formData.get('coordinate_x')),
        coordinate_y: parseFloat(formData.get('coordinate_y')),
        signal_quality: parseInt(formData.get('signal_quality'), 10)
    };

    // Validate coordinates before sending
    if (!validateCoordinates(data.coordinate_x, data.coordinate_y)) {
        showErrorToast('Invalid coordinates');
        return;
    }

    // Disable button during save operation
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    // Send POST request to server
    fetch('http://localhost:8080/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(async response => {
            if (!response.ok) {
                // Try to parse error message from response
                const error = await response.json();
                throw new Error(error.message || 'Server error');
            }
            return response.json();
        })
        .then(newDevice => {
            // Add new marker directly to cluster group
            markersLayer.addLayer(createMarker(newDevice));
            // Update local cache
            devicesCache.push(newDevice);

            // Close modal and show success
            bootstrap.Modal.getInstance('#addModal').hide();
            successToast.show();
            form.reset();
        })
        .catch(error => {
            showErrorToast(error.message);
        })
        .finally(() => {
            // Re-enable button regardless of success/failure
            button.disabled = false;
            button.innerHTML = 'Save';
        });
}

// Helper functions for validation and UI

/**
 * Validates geographic coordinates
 * @param {number} lng - Longitude value
 * @param {number} lat - Latitude value
 * @returns {boolean} True if coordinates are valid
 */
function validateCoordinates(lng, lat) {
    return !isNaN(lng) && !isNaN(lat) &&
        lng >= -180 && lng <= 180 &&
        lat >= -90 && lat <= 90;
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - Input text
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Shows error toast message
 * @param {string} message - Error message to display
 */
function showErrorToast(message) {
    // Create toast element dynamically
    const toast = new bootstrap.Toast(
        Object.assign(document.createElement('div'), {
            className: 'toast align-items-center text-bg-danger border-0',
            innerHTML: `
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                            data-bs-dismiss="toast"></button>
                </div>`
        }),
        { delay: 5000 }
    );
    // Add to container and show
    document.querySelector('.toast-container').appendChild(toast._element);
    toast.show();
}

// Initial load
loadDevices();