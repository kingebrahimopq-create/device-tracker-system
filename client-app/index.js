const axios = require('axios');
const os = require('os');
const crypto = require('crypto');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID || 'client_' + Date.now();
const DEVICE_ID = process.env.DEVICE_ID;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const CHECK_IN_INTERVAL = parseInt(process.env.CHECK_IN_INTERVAL || '30000', 10);

console.log('╔════════════════════════════════════════╗');
console.log('║ Device Tracker - Client Application ║');
console.log('╚════════════════════════════════════════╝');

function getSystemInfo() {
    return {
        deviceName: os.hostname(),
        osType: os.type(),
        osVersion: os.release(),
        platform: process.platform,
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        timestamp: new Date().toISOString(),
    };
}

function encryptData(data, key) {
    try {
        const algorithm = 'aes-256-cbc';
        const keyBuffer = Buffer.from(key, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
}

function decryptData(encryptedData, key) {
    try {
        const algorithm = 'aes-256-cbc';
        const keyBuffer = Buffer.from(key, 'hex');
        const parts = encryptedData.split(':');
        if (parts.length < 2) throw new Error('Invalid format');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts.length === 3 ? parts[2] : parts[1];
        const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        try {
            return JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
        } catch (e) {
            return { commands: [] };
        }
    }
}

class ClientService {
    constructor() {
        this.deviceId = DEVICE_ID || null;
        this.encryptionKey = ENCRYPTION_KEY || null;
        this.serverUrl = SERVER_URL;
    }

    async register(deviceInfo) {
        try {
            const response = await axios.post(this.serverUrl + '/api/clients/register', {
                clientId: CLIENT_ID,
                deviceInfo: deviceInfo,
            });

            if (response.data.success) {
                this.deviceId = response.data.deviceId;
                this.encryptionKey = response.data.encryptionKey;
                console.log('Device registered successfully');
                console.log('Device ID:', this.deviceId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Registration failed:', error.message);
            return false;
        }
    }

    async checkIn(systemInfo) {
        try {
            const payload = { ...systemInfo, timestamp: new Date().toISOString() };
            const encryptedData = encryptData(payload, this.encryptionKey);

            const response = await axios.post(this.serverUrl + '/api/clients/checkin', {
                deviceId: this.deviceId,
                encryptedData: encryptedData,
            });

            if (response.data.success && response.data.encryptedData) {
                const decryptedResponse = decryptData(response.data.encryptedData, this.encryptionKey);
                return decryptedResponse.commands || [];
            }
            return [];
        } catch (error) {
            console.error('Check-in failed:', error.message);
            return [];
        }
    }

    async reportResults(results, logs) {
        try {
            const payload = { results, logs, timestamp: new Date().toISOString() };
            const encryptedData = encryptData(payload, this.encryptionKey);

            await axios.post(this.serverUrl + '/api/clients/report', {
                deviceId: this.deviceId,
                results: results,
                logs: logs,
            });
            console.log('Report sent successfully');
        } catch (error) {
            console.error('Report failed:', error.message);
        }
    }

    async processCommands(commands) {
        const results = [];
        const logs = [];

        for (const command of commands) {
            try {
                console.log('Processing command:', command.type);
                let result;

                switch (command.type) {
                    case 'get_system_info':
                        result = getSystemInfo();
                        break;
                    case 'get_location':
                        result = { latitude: 0, longitude: 0, accuracy: 0 };
                        break;
                    case 'get_battery':
                        result = { level: 'unknown', charging: false };
                        break;
                    case 'get_network':
                        result = { type: 'unknown', connected: true };
                        break;
                    case 'take_screenshot':
                        result = { screenshot: 'base64_data', timestamp: new Date().toISOString() };
                        break;
                    case 'execute_shell':
                        result = { output: 'Command executed', exitCode: 0 };
                        break;
                    default:
                        result = { error: 'Unknown command' };
                }

                results.push({ commandId: command.id, status: 'completed', result });
                logs.push({ level: 'info', message: `Command ${command.type} executed` });
            } catch (error) {
                results.push({ commandId: command.id, status: 'failed', error: error.message });
                logs.push({ level: 'error', message: `Command ${command.type} failed: ${error.message}` });
            }
        }

        await this.reportResults(results, logs);
    }
}

async function main() {
    const client = new ClientService();

    if (!DEVICE_ID || !ENCRYPTION_KEY) {
        console.log('Registering device...');
        const systemInfo = getSystemInfo();
        await client.register(systemInfo);
    }

    console.log('Starting check-in service...');

    setInterval(async () => {
        try {
            const systemInfo = getSystemInfo();
            const commands = await client.checkIn(systemInfo);

            if (commands.length > 0) {
                console.log('Received', commands.length, 'commands');
                await client.processCommands(commands);
            }
        } catch (error) {
            console.error('Check-in error:', error.message);
        }
    }, CHECK_IN_INTERVAL);
}

process.on('SIGINT', () => {
    console.log('\nStopping client...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nStopping client...');
    process.exit(0);
});

main();
