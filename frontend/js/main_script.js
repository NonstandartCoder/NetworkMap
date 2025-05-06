// Initialize the map with canvas renderer for performance
const map = L.map('map', {
    renderer: L.canvas()
}).setView([55.751244, 37.618423], 15);
map.attributionControl.setPrefix('<a href="https://openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

// Initialize MarkerClusterGroup for clustering
const markersLayer = L.markerClusterGroup({
    maxClusterRadius: 100,
    disableClusteringAtZoom: 18,
    spiderfyOnMaxZoom: false,
    chunkedLoading: true
}).addTo(map);

let selectedCoordinates = null;
let devicesCache = [];

// Toast notifications
const successToast = new bootstrap.Toast(document.getElementById('successToast'), { delay: 3000 });
const mapClickToast = new bootstrap.Toast(document.getElementById('mapClickToast'), { delay: 5000 });

// Generate color based on signal quality
function getSignalColor(signal) {
    const ratio = Math.min(Math.max(signal, 0), 10) / 10;
    let r, g, b;
    if (ratio <= 0.5) {
        const subRatio = ratio * 2;
        r = 255;
        g = Math.round(255 * subRatio);
        b = 0;
    } else {
        const subRatio = (ratio - 0.5) * 2;
        r = Math.round(255 * (1 - subRatio));
        g = 255;
        b = 0;
    }
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Create marker with custom icon
function createMarker(device) {
    const color = getSignalColor(device.signal_quality);
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

    return L.marker([device.coordinate_y, device.coordinate_x], { icon })
        .bindPopup(`
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

// Update markers with batch processing
function updateMarkers(devices) {
    markersLayer.clearLayers();
    devicesCache = devices;

    // Batch process markers for performance
    const batchSize = 1000;
    let index = 0;

    function addBatch() {
        const batch = devices.slice(index, index + batchSize);
        batch.forEach(device => {
            markersLayer.addLayer(createMarker(device));
        });
        index += batchSize;
        if (index < devices.length) setTimeout(addBatch, 50);
    }

    addBatch();
}

// Load devices from server
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

// Show add device form
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

// Save new device
function saveDevice(button) {
    const form = document.getElementById('deviceForm');
    const formData = new FormData(form);
    const data = {
        device_id: escapeHtml(formData.get('device_id')),
        coordinate_x: parseFloat(formData.get('coordinate_x')),
        coordinate_y: parseFloat(formData.get('coordinate_y')),
        signal_quality: parseInt(formData.get('signal_quality'), 10)
    };

    // Validation
    if (!validateCoordinates(data.coordinate_x, data.coordinate_y)) {
        showErrorToast('Invalid coordinates');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    fetch('http://localhost:8080/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(async response => {
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Server error');
            }
            return response.json();
        })
        .then(newDevice => {
            // Add new marker directly to cluster group
            markersLayer.addLayer(createMarker(newDevice));
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
            button.disabled = false;
            button.innerHTML = 'Save';
        });
}

// Helper functions
function validateCoordinates(lng, lat) {
    return !isNaN(lng) && !isNaN(lat) &&
        lng >= -180 && lng <= 180 &&
        lat >= -90 && lat <= 90;
}

function escapeHtml(text) {
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showErrorToast(message) {
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
    document.querySelector('.toast-container').appendChild(toast._element);
    toast.show();
}

// Initial load
loadDevices();