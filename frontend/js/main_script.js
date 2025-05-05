// Константы
const TARGET_RADIUS_METERS = 30; // Фиксированный радиус в метрах

// Инициализация карты
const map = L.map('map').setView([55.751244, 37.618423], 15);
map.attributionControl.setPrefix('<a href="https://openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 4,
    maxZoom: 19
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let selectedCoordinates = null;

// Цвет маркера в зависимости от качества сигнала
function getSignalColor(signal) {
    if (signal >= 8) return '#00C851'; // Зеленый
    if (signal >= 4) return '#ffbb33'; // Желтый
    return '#ff4444'; // Красный
}

// Загрузка и отображение устройств
function updateMarkers(devices) {
    markersLayer.clearLayers();
    const radius = 30;

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

// Загрузка устройств с сервера
function loadDevices() {
    fetch('http://localhost:8080/api/devices')
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(updateMarkers)
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to load devices');
        });
}

// Показ формы добавления устройства
function showAddForm() {
    const modal = new bootstrap.Modal('#addModal');
    selectedCoordinates = null;

    map.once('click', e => {
        selectedCoordinates = e.latlng;
        document.querySelector('[name="coordinate_x"]').value = e.latlng.lng.toFixed(6);
        document.querySelector('[name="coordinate_y"]').value = e.latlng.lat.toFixed(6);
        modal.show();
    });

    alert('Please click on the map to select device location');
}

// Сохранение нового устройства
function saveDevice() {
    const formData = new FormData(document.getElementById('deviceForm'));

    const data = {
        device_id: formData.get('device_id'),
        coordinate_x: formData.get('coordinate_x'),
        coordinate_y: formData.get('coordinate_y'),
        signal_quality: formData.get('signal_quality')
    };

    fetch('http://localhost:8080/api/devices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (response.ok) return response.json();
            return response.json().then(err => {
                throw new Error(err.errors?.join(', ') || 'Server error')
            });
        })
        .then(() => {
            loadDevices();
            bootstrap.Modal.getInstance('#addModal').hide();
            alert('Device added successfully!');
        })
        .catch(error => {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        });
}

// Инициализация
loadDevices();