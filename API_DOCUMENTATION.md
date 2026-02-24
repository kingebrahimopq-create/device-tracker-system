# توثيق API - Device Tracker System

دليل شامل لجميع نقاط نهاية API في نظام Device Tracker.

## 📋 جدول المحتويات

1. [المصادقة](#المصادقة)
2. [الأجهزة](#الأجهزة)
3. [الأوامر](#الأوامر)
4. [السجلات](#السجلات)
5. [العملاء](#العملاء)
6. [رموز الأخطاء](#رموز-الأخطاء)

---

## 🔐 المصادقة

جميع الطلبات يجب أن تتضمن:
- `deviceId`: معرف الجهاز الفريد
- `encryptedData`: البيانات المشفرة (اختياري حسب النقطة)

### مثال الرأس (Header)
```
Content-Type: application/json
Authorization: Bearer {token}
```

---

## 🖥️ الأجهزة

### 1. الحصول على قائمة الأجهزة

**الطلب:**
```http
GET /api/devices
```

**الاستجابة (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "جهازي الشخصي",
    "status": "online",
    "lastSeen": "2024-02-24T12:00:00Z",
    "osType": "Android",
    "osVersion": "12",
    "location": {
      "latitude": 24.7136,
      "longitude": 46.6753,
      "timestamp": "2024-02-24T12:00:00Z"
    }
  }
]
```

---

### 2. الحصول على جهاز محدد

**الطلب:**
```http
GET /api/devices/{deviceId}
```

**المعاملات:**
- `deviceId` (string, مطلوب): معرف الجهاز

**الاستجابة (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "جهازي الشخصي",
  "status": "online",
  "lastSeen": "2024-02-24T12:00:00Z",
  "createdAt": "2024-02-24T10:00:00Z",
  "osType": "Android",
  "osVersion": "12",
  "appVersion": "1.0.0",
  "location": {
    "latitude": 24.7136,
    "longitude": 46.6753,
    "timestamp": "2024-02-24T12:00:00Z"
  }
}
```

**رموز الخطأ:**
- `404`: الجهاز غير موجود

---

## 📡 الأوامر

### 1. إرسال أمر إلى جهاز

**الطلب:**
```http
POST /api/commands
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "execute_shell",
  "payload": {
    "command": "ls -la"
  }
}
```

**أنواع الأوامر المدعومة:**

| النوع | الوصف | Payload |
|-------|-------|---------|
| `get_system_info` | معلومات النظام | `{}` |
| `get_location` | الموقع الجغرافي | `{}` |
| `get_logs` | السجلات | `{ "limit": 100 }` |
| `execute_shell` | تنفيذ أمر | `{ "command": "ls" }` |
| `run_script` | تشغيل سكريبت | `{ "script": "...", "language": "bash" }` |
| `list_files` | قائمة الملفات | `{ "path": "/home" }` |
| `read_file` | قراءة ملف | `{ "path": "/etc/hosts" }` |
| `take_screenshot` | لقطة شاشة | `{}` |
| `ping` | اختبار الاتصال | `{}` |
| `sync` | مزامنة | `{}` |

**الاستجابة (200):**
```json
{
  "success": true,
  "commandId": "cmd_550e8400-e29b-41d4-a716-446655440000",
  "message": "تم إرسال الأمر"
}
```

**رموز الخطأ:**
- `400`: بيانات غير صحيحة
- `403`: أمر محظور لأسباب أمنية
- `404`: الجهاز غير موجود

---

### 2. الحصول على أوامر جهاز

**الطلب:**
```http
GET /api/commands/{deviceId}
```

**المعاملات:**
- `deviceId` (string, مطلوب): معرف الجهاز
- `status` (string, اختياري): تصفية حسب الحالة (pending, executing, completed, failed)
- `limit` (number, اختياري): عدد الأوامر (افتراضي: 50)

**الاستجابة (200):**
```json
[
  {
    "id": "cmd_550e8400-e29b-41d4-a716-446655440000",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "execute_shell",
    "payload": {
      "command": "ls -la"
    },
    "status": "completed",
    "result": {
      "output": "total 24\ndrwxr-xr-x  5 user user 4096 Feb 24 12:00 .",
      "exitCode": 0
    },
    "createdAt": "2024-02-24T12:00:00Z",
    "executedAt": "2024-02-24T12:00:05Z",
    "expiresAt": "2024-02-24T12:05:00Z"
  }
]
```

---

### 3. الحصول على أمر محدد

**الطلب:**
```http
GET /api/commands/{deviceId}/{commandId}
```

**الاستجابة (200):**
```json
{
  "id": "cmd_550e8400-e29b-41d4-a716-446655440000",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "execute_shell",
  "payload": {
    "command": "ls -la"
  },
  "status": "completed",
  "result": {
    "output": "...",
    "exitCode": 0
  },
  "createdAt": "2024-02-24T12:00:00Z",
  "executedAt": "2024-02-24T12:00:05Z",
  "expiresAt": "2024-02-24T12:05:00Z"
}
```

---

## 📝 السجلات

### 1. الحصول على سجلات جهاز

**الطلب:**
```http
GET /api/logs/{deviceId}
```

**المعاملات:**
- `deviceId` (string, مطلوب): معرف الجهاز
- `level` (string, اختياري): تصفية حسب المستوى (info, warning, error, debug)
- `limit` (number, اختياري): عدد السجلات (افتراضي: 100)
- `offset` (number, اختياري): تخطي عدد من السجلات

**الاستجابة (200):**
```json
[
  {
    "id": "log_550e8400-e29b-41d4-a716-446655440000",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "level": "info",
    "message": "تم تنفيذ الأمر بنجاح",
    "timestamp": "2024-02-24T12:00:00Z",
    "metadata": {
      "commandId": "cmd_550e8400-e29b-41d4-a716-446655440000",
      "duration": 5000
    }
  }
]
```

---

### 2. إنشاء سجل جديد

**الطلب:**
```http
POST /api/logs
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "level": "info",
  "message": "رسالة السجل",
  "metadata": {
    "key": "value"
  }
}
```

**الاستجابة (201):**
```json
{
  "id": "log_550e8400-e29b-41d4-a716-446655440000",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "level": "info",
  "message": "رسالة السجل",
  "timestamp": "2024-02-24T12:00:00Z"
}
```

---

## 👥 العملاء

### 1. تسجيل عميل جديد

**الطلب:**
```http
POST /api/clients/register
Content-Type: application/json

{
  "clientId": "client_123",
  "deviceInfo": {
    "deviceName": "جهازي",
    "osType": "Android",
    "osVersion": "12",
    "appVersion": "1.0.0"
  }
}
```

**الاستجابة (200):**
```json
{
  "success": true,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "encryptionKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "message": "تم التسجيل بنجاح"
}
```

---

### 2. الاتصال الدوري (Check-in)

**الطلب:**
```http
POST /api/clients/checkin
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "encryptedData": "iv:tag:encrypted_data"
}
```

**البيانات المفك تشفيرها:**
```json
{
  "location": {
    "latitude": 24.7136,
    "longitude": 46.6753
  },
  "batteryLevel": 85,
  "isCharging": false,
  "timestamp": "2024-02-24T12:00:00Z"
}
```

**الاستجابة (200):**
```json
{
  "success": true,
  "encryptedData": "iv:tag:encrypted_response"
}
```

**البيانات المشفرة في الاستجابة:**
```json
{
  "status": "success",
  "commands": [
    {
      "id": "cmd_550e8400-e29b-41d4-a716-446655440000",
      "type": "execute_shell",
      "payload": {
        "command": "ls -la"
      }
    }
  ],
  "timestamp": "2024-02-24T12:00:00Z"
}
```

---

### 3. إرسال تقرير

**الطلب:**
```http
POST /api/clients/report
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "encryptedData": "iv:tag:encrypted_data"
}
```

**البيانات المفك تشفيرها:**
```json
{
  "commandResults": [
    {
      "commandId": "cmd_550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "result": {
        "output": "...",
        "exitCode": 0
      }
    }
  ],
  "logs": [
    {
      "level": "info",
      "message": "تم تنفيذ الأمر",
      "timestamp": "2024-02-24T12:00:00Z"
    }
  ]
}
```

**الاستجابة (200):**
```json
{
  "success": true,
  "message": "تم استقبال التقرير"
}
```

---

## ⚠️ رموز الأخطاء

### رموز HTTP

| الرمز | الوصف |
|------|-------|
| `200` | نجح الطلب |
| `201` | تم إنشاء المورد |
| `400` | طلب غير صحيح |
| `401` | غير مصرح |
| `403` | محظور |
| `404` | غير موجود |
| `500` | خطأ في الخادم |

### رموز الأخطاء المخصصة

```json
{
  "error": "وصف الخطأ",
  "code": "ERROR_CODE",
  "details": {
    "field": "اسم الحقل",
    "message": "رسالة التفاصيل"
  }
}
```

### أمثلة الأخطاء

**خطأ في البيانات:**
```json
{
  "error": "معرف الجهاز والبيانات المشفرة مطلوبة",
  "code": "MISSING_REQUIRED_FIELDS"
}
```

**أمر محظور:**
```json
{
  "error": "هذا الأمر محظور لأسباب أمنية",
  "code": "FORBIDDEN_COMMAND"
}
```

**جهاز غير موجود:**
```json
{
  "error": "الجهاز غير موجود",
  "code": "DEVICE_NOT_FOUND"
}
```

---

## 🔐 التشفير

### صيغة البيانات المشفرة

```
IV:TAG:ENCRYPTED_DATA
```

حيث:
- `IV`: Initialization Vector (16 بايت، hex)
- `TAG`: Authentication Tag (16 بايت، hex)
- `ENCRYPTED_DATA`: البيانات المشفرة (hex)

### مثال

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6:f1e2d3c4b5a6g7h8i9j0k1l2m3n4o5p6:encrypted_content_here
```

---

## 📊 أمثلة عملية

### مثال 1: تنفيذ أمر shell

```bash
# 1. إرسال الأمر
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "execute_shell",
    "payload": {
      "command": "echo Hello World"
    }
  }'

# 2. الحصول على الأوامر
curl http://localhost:3000/api/commands/550e8400-e29b-41d4-a716-446655440000

# 3. عرض النتيجة
# سيظهر في السجلات بعد تنفيذ العميل للأمر
```

### مثال 2: الحصول على معلومات النظام

```bash
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "get_system_info",
    "payload": {}
  }'
```

### مثال 3: الحصول على الموقع

```bash
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "get_location",
    "payload": {}
  }'
```

---

## 🧪 الاختبار

### استخدام Postman

1. استورد الـ endpoints
2. عيّن متغيرات البيئة
3. اختبر كل endpoint

### استخدام cURL

```bash
# اختبار الخادم
curl http://localhost:3000/api/devices

# اختبار مع البيانات
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test", "type": "ping", "payload": {}}'
```

### استخدام JavaScript

```javascript
// جلب قائمة الأجهزة
fetch('http://localhost:3000/api/devices')
  .then(res => res.json())
  .then(data => console.log(data));

// إرسال أمر
fetch('http://localhost:3000/api/commands', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'device-id',
    type: 'ping',
    payload: {}
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

**آخر تحديث:** 24 فبراير 2026  
**الإصدار:** 1.0.0
