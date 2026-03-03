// Device Tracker App - Main JavaScript

(function() {
    'use strict';
    
    // Configuration
    let config = {};
    let deviceId = null;
    let encryptionKey = null;
    let checkInInterval = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    
    // DOM Elements
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const loadingCard = document.getElementById('loadingCard');
    const successCard = document.getElementById('successCard');
    const errorCard = document.getElementById('errorCard');
    const warningCard = document.getElementById('warningCard');
    const errorMessage = document.getElementById('errorMessage');
    const warningMessage = document.getElementById('warningMessage');
    const batteryLevel = document.getElementById('batteryLevel');
    const networkType = document.getElementById('networkType');
    const locationStatus = document.getElementById('locationStatus');
    
    // Load configuration
    function loadConfig() {
        try {
            const configScript = document.getElementById('app-config');
            if (configScript) {
                config = JSON.parse(configScript.textContent);
                console.log('✅ Configuration loaded:', config.configId);
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to load config:', error);
        }
        return false;
    }
    
    // Load saved device ID
    function loadDeviceId() {
        try {
            const saved = localStorage.getItem('deviceTracker_deviceId');
            const savedKey = localStorage.getItem('deviceTracker_encryptionKey');
            if (saved && savedKey) {
                deviceId = saved;
                encryptionKey = savedKey;
                console.log('✅ Loaded saved device ID:', deviceId);                return true;
            }
        } catch (error) {
            console.error('❌ Failed to load device ID:', error);
        }
        return false;
    }
    
    // Save device ID
    function saveDeviceId(id, key) {
        try {
            localStorage.setItem('deviceTracker_deviceId', id);
            localStorage.setItem('deviceTracker_encryptionKey', key);
            deviceId = id;
            encryptionKey = key;
            console.log('✅ Device ID saved:', id);
        } catch (error) {
            console.error('❌ Failed to save device ID:', error);
        }
    }
    
    // Update status bar
    function updateStatus(status, text) {
        statusBar.className = 'status-bar ' + status;
        statusText.textContent = text;
    }
    
    // Show card
    function showCard(card) {
        loadingCard.classList.add('hidden');
        successCard.classList.add('hidden');
        errorCard.classList.add('hidden');
        warningCard.classList.add('hidden');
        
        if (card === 'loading') loadingCard.classList.remove('hidden');
        else if (card === 'success') successCard.classList.remove('hidden');
        else if (card === 'error') errorCard.classList.remove('hidden');
        else if (card === 'warning') warningCard.classList.remove('hidden');
    }
    
    // Register device
    async function registerDevice() {
        try {
            console.log('📱 Registering device...');
            updateStatus('connecting', 'جاري التسجيل...');
            
            const deviceInfo = {
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                language: navigator.language,                screenResolution: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            
            const response = await fetch(config.server.url + '/api/clients/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: 'device_' + Date.now(),
                    deviceInfo: deviceInfo
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                saveDeviceId(data.deviceId, data.encryptionKey);
                console.log('✅ Device registered:', data.deviceId);
                return true;
            } else {
                throw new Error(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('❌ Registration failed:', error);
            return false;
        }
    }
    
    // Send check-in
    async function sendCheckIn() {
        try {
            if (!deviceId) {
                const registered = await registerDevice();
                if (!registered) throw new Error('Failed to register device');
            }
            
            updateStatus('connecting', 'جاري الإرسال...');
            
            const response = await fetch(config.server.url + '/api/clients/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: deviceId,
                    encryptedData: null
                })
            });
            
            const data = await response.json();
            
            if (data.success) {                updateStatus('online', 'متصل');
                showCard('success');
                updateDeviceInfo();
                retryCount = 0;
                return true;
            } else {
                throw new Error(data.error || 'Check-in failed');
            }
        } catch (error) {
            console.error('❌ Check-in failed:', error);
            retryCount++;
            
            if (retryCount >= MAX_RETRIES) {
                updateStatus('offline', 'غير متصل');
                errorMessage.textContent = 'فشل الاتصال بعد ' + MAX_RETRIES + ' محاولات. تأكد من اتصال الإنترنت.';
                showCard('error');
            } else {
                updateStatus('connecting', 'إعادة المحاولة (' + retryCount + '/' + MAX_RETRIES + ')...');
                showCard('warning');
                warningMessage.textContent = 'جاري إعادة المحاولة خلال ' + (config.server.checkInInterval / 1000) + ' ثواني...';
            }
            
            return false;
        }
    }
    
    // Update device info
    function updateDeviceInfo() {
        // Battery
        if ('battery' in navigator) {
            navigator.getBattery().then(battery => {
                batteryLevel.textContent = Math.round(battery.level * 100) + '%';
                battery.addEventListener('levelchange', () => {
                    batteryLevel.textContent = Math.round(battery.level * 100) + '%';
                });
            });
        } else {
            batteryLevel.textContent = 'غير متوفر';
        }
        
        // Network
        if ('connection' in navigator) {
            networkType.textContent = navigator.connection.effectiveType || 'unknown';
        } else {
            networkType.textContent = 'غير متوفر';
        }
        
        // Location
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(                () => { locationStatus.textContent = 'مفعل'; },
                () => { locationStatus.textContent = 'معطل'; }
            );
        } else {
            locationStatus.textContent = 'غير متوفر';
        }
    }
    
    // Force check-in
    window.forceCheckIn = function() {
        retryCount = 0;
        sendCheckIn();
    };
    
    // Retry connection
    window.retryConnection = function() {
        retryCount = 0;
        sendCheckIn();
    };
    
    // Show details
    window.showDetails = function() {
        alert('التطبيق: ' + config.app.name + '\n' +
              'الإصدار: ' + config.app.version + '\n' +
              'Device ID: ' + (deviceId || 'غير مسجل') + '\n' +
              'Server: ' + config.server.url);
    };
    
    // Start check-in interval
    function startCheckInInterval() {
        if (checkInInterval) {
            clearInterval(checkInInterval);
        }
        checkInInterval = setInterval(() => {
            sendCheckIn();
        }, config.server.checkInInterval);
    }
    
    // Initialize app
    async function init() {
        console.log('🚀 Initializing Device Tracker...');
        
        // Load config
        if (!loadConfig()) {
            alert('فشل تحميل الإعدادات!');
            return;
        }
        
        // Create animated circles
        createCircles();        
        // Try to load saved device ID
        loadDeviceId();
        
        // Initial check-in
        await sendCheckIn();
        
        // Start periodic check-ins
        startCheckInInterval();
        
        console.log('✅ Device Tracker initialized');
    }
    
    // Create animated background circles
    function createCircles() {
        const container = document.getElementById('circles');
        for (let i = 0; i < 10; i++) {
            const circle = document.createElement('div');
            circle.className = 'circle';
            circle.style.width = Math.random() * 100 + 50 + 'px';
            circle.style.height = circle.style.width;
            circle.style.left = Math.random() * 100 + '%';
            circle.style.animationDelay = Math.random() * 20 + 's';
            circle.style.animationDuration = (Math.random() * 20 + 20) + 's';
            container.appendChild(circle);
        }
    }
    
    // Start app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();