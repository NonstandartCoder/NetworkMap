// Инициализация карты
const map = L.map('map').setView([55.751244, 37.618423], 15);
map.attributionControl.setPrefix('<a href="https://openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 4,
    maxZoom: 19
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let selectedCoordinates = null;

// Инициализация Toast
const successToast = new bootstrap.Toast(document.getElementById('successToast'), { delay: 3000 });
const mapClickToast = new bootstrap.Toast(document.getElementById('mapClickToast'), { delay: 5000 });

// Цвет маркера в зависимости от качества сигнала
// Генерация градиентного цвета от красного (0) до зелёного (10)
// Генерация градиентного цвета: красный (0) → жёлтый (5) → зелёный (10)
function getSignalColor(signal) {
    const ratio = Math.min(Math.max(signal, 0), 10) / 10; // Нормализация 0–10 к 0–1

    let r, g, b;
    if (ratio <= 0.5) {
        // От красного (#FF0000) к жёлтому (#FFFF00)
        const subRatio = ratio * 2; // Масштабируем 0–0.5 к 0–1
        r = 255;
        g = Math.round(255 * subRatio); // Зелёный растёт от 0 до 255
        b = 0;
    } else {
        // От жёлтого (#FFFF00) к зелёному (#00FF00)
        const subRatio = (ratio - 0.5) * 2; // Масштабируем 0.5–1 к 0–1
        r = Math.round(255 * (1 - subRatio)); // Красный падает от 255 до 0
        g = 255;
        b = 0;
    }

    // Преобразуем в HEX
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
            // Показываем ошибку через Toast
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
                { delay: 5000 }
            );
            document.querySelector('.toast-container').appendChild(errorToast._element);
            errorToast.show();
        });
}

// Показ формы добавления устройства
function showAddForm() {
    const modal = new bootstrap.Modal('#addModal');
    selectedCoordinates = null;

    mapClickToast.show(); // Показываем Toast вместо alert

    map.once('click', e => {
        selectedCoordinates = e.latlng;
        document.querySelector('[name="coordinate_x"]').value = e.latlng.lng.toFixed(6);
        document.querySelector('[name="coordinate_y"]').value = e.latlng.lat.toFixed(6);
        mapClickToast.hide(); // Скрываем Toast после клика
        modal.show();
    });
}

// Сохранение нового устройства
function saveDevice() {
    const formData = new FormData(document.getElementById('deviceForm'));

    const data = {
        device_id: formData.get('device_id'),
        coordinate_x: parseFloat(formData.get('coordinate_x')),
        coordinate_y: parseFloat(formData.get('coordinate_y')),
        signal_quality: parseInt(formData.get('signal_quality'), 10)
    };

    // Проверка координат
    if (!data.coordinate_x || !data.coordinate_y) {
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
            { delay: 5000 }
        );
        document.querySelector('.toast-container').appendChild(errorToast._element);
        errorToast.show();
        return;
    }

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
                throw new Error(err.errors?.join(', ') || 'Server error');
            });
        })
        .then(() => {
            loadDevices();
            bootstrap.Modal.getInstance('#addModal').hide();
            successToast.show(); // Показываем Toast вместо alert
        })
        .catch(error => {
            console.error('Error:', error);
            const errorToast = new bootstrap.Toast(
                Object.assign(document.createElement('div'), {
                    className: 'toast align-items-center text-bg-danger border-0',
                    role: 'alert',
                    innerHTML: `
                        <div class="d-flex">
                            <div class="toast-body">Error: ${error.message}</div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>`
                }),
            );
            document.querySelector('.toast-container').appendChild(errorToast._element);
            errorToast.show();
        });
}

// Инициализация
loadDevices();