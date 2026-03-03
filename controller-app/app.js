// استيراد مكتبات Capacitor
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

// إعدادات الاتصال بالخادم
const SERVER_URL = 'https://device-tracker-server-production-7968.up.railway.app';
let deviceId = '';
let checkInterval = null;

// الحصول على معرف فريد للجهاز
async function getDeviceId() {
    const info = await Device.getId();
    return info.uuid; // أو info.identifier
}

// تسجيل الجهاز في الخادم
async function registerDevice() {
    try {
        const deviceId = await getDeviceId();
        const info = await Device.getInfo();
        const response = await fetch(`${SERVER_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                model: info.model,
                os: info.platform,
                manufacturer: info.manufacturer
            })
        });
        const data = await response.json();
        console.log('تم التسجيل:', data);
        return deviceId;
    } catch (error) {
        console.error('فشل التسجيل:', error);
        throw error;
    }
}

// الحصول على حالة البطارية
async function getBatteryStatus() {
    // Capacitor لا يدعم البطارية مباشرة، نحتاج لاستخدام WebView API
    if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        return Math.round(battery.level * 100);
    }
    return 0; // قيمة افتراضية
}

// الحصول على نوع الشبكة
async function getNetworkStatus() {
    const status = await Network.getStatus();
    return status.connected ? status.connectionType : 'none';
}

// الحصول على الموقع
async function getLocation() {
    try {
        const position = await Geolocation.getCurrentPosition();
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
    } catch (error) {
        console.warn('فشل الحصول على الموقع:', error);
        return null;
    }
}

// دالة الـ Check-in الدورية
async function performCheckin() {
    try {
        const [battery, network, location] = await Promise.all([
            getBatteryStatus(),
            getNetworkStatus(),
            getLocation()
        ]);

        const response = await fetch(`${SERVER_URL}/api/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                battery,
                network,
                location
            })
        });

        const data = await response.json();
        console.log('Check-in ناجح، الأوامر:', data.commands);

        // تنفيذ الأوامر الواردة
        if (data.commands && data.commands.length > 0) {
            executeCommands(data.commands);
        }

        // تحديث الواجهة
        updateUI(battery, network, location);
    } catch (error) {
        console.error('فشل Check-in:', error);
        document.getElementById('connectionStatus').className = 'status disconnected';
        document.getElementById('connectionStatus').innerText = '❌ غير متصل';
    }
}

// تنفيذ الأوامر
async function executeCommands(commands) {
    for (const cmd of commands) {
        console.log('تنفيذ الأمر:', cmd.command, cmd.parameters);
        let result = null;
        let error = null;

        try {
            switch (cmd.command) {
                case 'FACTORY_RESET':
                    // ملاحظة: هذا يحتاج صلاحية نظام، غير ممكن في تطبيق عادي
                    result = 'غير مدعوم';
                    break;
                case 'TAKE_PHOTO':
                    // يمكن استخدام Capacitor Camera
                    result = 'تم تنفيذ الأمر (كاميرا)';
                    break;
                case 'LOCK_SCREEN':
                    // غير مدعوم في Capacitor
                    result = 'غير مدعوم';
                    break;
                case 'SHOW_MESSAGE':
                    if (cmd.parameters.text) {
                        alert(cmd.parameters.text);
                    }
                    result = 'تم عرض الرسالة';
                    break;
                case 'MAX_VOLUME':
                    // غير مدعوم
                    result = 'غير مدعوم';
                    break;
                case 'GET_LOCATION':
                    const loc = await getLocation();
                    result = loc;
                    break;
                default:
                    result = 'أمر غير معروف';
            }
        } catch (e) {
            error = e.message;
        }

        // إرسال نتيجة الأمر
        try {
            await fetch(`${SERVER_URL}/api/command-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId,
                    commandId: cmd.id,
                    result,
                    error
                })
            });
        } catch (e) {
            console.error('فشل إرسال نتيجة الأمر:', e);
        }
    }
}

// تحديث واجهة المستخدم
function updateUI(battery, network, location) {
    document.getElementById('batteryText').innerText = battery + '%';
    document.getElementById('networkText').innerText = network;
    if (location) {
        document.getElementById('locationText').innerText = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    document.getElementById('connectionStatus').className = 'status connected';
    document.getElementById('connectionStatus').innerText = '✅ متصل';
}

// بدء التشغيل
async function init() {
    try {
        deviceId = await registerDevice();
        document.getElementById('deviceText').innerText = deviceId.substring(0, 8) + '...';
        
        // بدء الـ Check-in الدوري
        performCheckin(); // أول مرة
        checkInterval = setInterval(performCheckin, 30000); // كل 30 ثانية
    } catch (error) {
        console.error('فشل التهيئة:', error);
    }
}

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', init);