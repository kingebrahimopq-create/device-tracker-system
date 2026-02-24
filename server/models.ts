/**
 * نماذج البيانات والأوامر
 */

export interface Device {
  id: string; // معرف فريد للجهاز
  name: string; // اسم الجهاز
  clientId: string; // معرف العميل
  encryptionKey: string; // مفتاح التشفير الفريد
  status: 'online' | 'offline'; // حالة الاتصال
  lastSeen: Date; // آخر اتصال
  createdAt: Date; // تاريخ الإنشاء
  osType: string; // نوع النظام (Android/iOS)
  osVersion: string; // إصدار النظام
  appVersion: string; // إصدار التطبيق
  location?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
}

export interface Command {
  id: string;
  deviceId: string;
  type: CommandType;
  payload: any;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  executedAt?: Date;
  expiresAt: Date; // انتهاء صلاحية الأمر
}

export enum CommandType {
  // أوامر النظام
  GET_SYSTEM_INFO = 'get_system_info',
  GET_LOCATION = 'get_location',
  GET_LOGS = 'get_logs',
  
  // أوامر التنفيذ
  EXECUTE_SHELL = 'execute_shell',
  RUN_SCRIPT = 'run_script',
  
  // أوامر الملفات
  LIST_FILES = 'list_files',
  READ_FILE = 'read_file',
  
  // أوامر الشاشة
  TAKE_SCREENSHOT = 'take_screenshot',
  
  // أوامر الاتصال
  PING = 'ping',
  SYNC = 'sync',
}

export interface CommandPayload {
  [CommandType.GET_SYSTEM_INFO]: {};
  [CommandType.GET_LOCATION]: {};
  [CommandType.GET_LOGS]: { limit?: number };
  [CommandType.EXECUTE_SHELL]: { command: string };
  [CommandType.RUN_SCRIPT]: { script: string; language: 'bash' | 'python' | 'javascript' };
  [CommandType.LIST_FILES]: { path: string };
  [CommandType.READ_FILE]: { path: string };
  [CommandType.TAKE_SCREENSHOT]: {};
  [CommandType.PING]: {};
  [CommandType.SYNC]: {};
}

export interface Log {
  id: string;
  deviceId: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  metadata?: any;
}

export interface SystemInfo {
  deviceName: string;
  osType: string;
  osVersion: string;
  manufacturer: string;
  model: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
  batteryLevel: number;
  isCharging: boolean;
  screenBrightness: number;
  locale: string;
  timezone: string;
}

/**
 * الأوامر المحظورة (لا يمكن تنفيذها)
 */
export const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'dd if=/dev/zero of=/dev/sda',
  'mkfs',
  'format',
  'fdisk',
  'parted',
];

/**
 * الكلمات المفتاحية المحظورة
 */
export const BLOCKED_KEYWORDS = [
  'rm -rf',
  'delete',
  'remove',
  'format',
  'wipe',
  'erase',
  'passwd',
  'password',
  'sudo',
];

/**
 * التحقق من أمان الأمر
 */
export function isSafeCommand(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  
  // التحقق من الأوامر المحظورة
  for (const blocked of BLOCKED_COMMANDS) {
    if (lowerCommand.includes(blocked.toLowerCase())) {
      return false;
    }
  }
  
  // التحقق من الكلمات المفتاحية المحظورة
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lowerCommand.includes(keyword.toLowerCase())) {
      return false;
    }
  }
  
  return true;
}

/**
 * طلب الاتصال من العميل
 */
export interface ClientCheckInRequest {
  clientId: string;
  deviceId?: string;
  encryptedData: string; // بيانات مشفرة تحتوي على معلومات النظام
}

/**
 * استجابة الخادم للعميل
 */
export interface ServerResponse {
  status: 'success' | 'error';
  commands: Command[];
  timestamp: Date;
  encryptedData?: string;
}
