# 📱 Device Tracker System

> نظام متتبع الأجهزة المتقدم مع التشفير والأوامر الآمنة

[![GitHub Stars](https://img.shields.io/github/stars/kingebrahimopq-create/device-tracker-system?style=flat-square)](https://github.com/kingebrahimopq-create/device-tracker-system)
[![GitHub License](https://img.shields.io/github/license/kingebrahimopq-create/device-tracker-system?style=flat-square)](LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/kingebrahimopq-create/device-tracker-system?style=flat-square)](https://github.com/kingebrahimopq-create/device-tracker-system/issues)

## 🎯 نظرة عامة

نظام متكامل وآمن لتتبع الأجهزة وإدارتها عن بعد مع:

- 🔐 **تشفير متقدم**: AES-256-GCM من طرف إلى طرف
- ⚡ **خدمة خلفية**: اتصال دوري كل 30 ثانية
- 🛡️ **أوامر آمنة**: حظر الأوامر الخطرة والتحقق من الكلمات المفتاحية
- 📊 **معلومات شاملة**: نظام، موقع، سجلات، أحداث
- 🌐 **API RESTful**: 10+ endpoints متقدمة
- 📱 **توليد APK**: تطبيق عميل مخصص لكل جهاز

## 🚀 البدء السريع

### المتطلبات

```bash
- Node.js 14+
- npm 6+
- Git
```

### التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/kingebrahimopq-create/device-tracker-system.git
cd device-tracker-system

# تثبيت الخادم
cd server
npm install
npm run dev

# في نافذة أخرى: تثبيت العميل
cd client-app
npm install
npm run dev
```

### الاختبار

```bash
# الحصول على قائمة الأجهزة
curl http://localhost:3000/api/devices

# إرسال أمر
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-id",
    "type": "get_system_info",
    "payload": {}
  }'
```

## 📁 هيكل المشروع

```
device-tracker-system/
├── server/                    # خادم Express
│   ├── index.ts              # نقطة الدخول الرئيسية
│   ├── encryption.ts         # نظام التشفير AES-256-GCM
│   ├── models.ts             # نماذج البيانات
│   └── package.json
├── client-app/               # تطبيق العميل
│   ├── index.ts              # نقطة الدخول
│   ├── client-service.ts     # خدمة الاتصال
│   └── package.json
├── docs/                     # صفحة GitHub Pages
│   ├── index.html            # الصفحة الرئيسية
│   └── _config.yml           # إعدادات Jekyll
├── COMPLETE_PROJECT.md       # الملف الشامل الكامل
├── README.md                 # دليل شامل
├── QUICK_START.md            # البدء السريع
├── API_DOCUMENTATION.md      # توثيق API
├── APK_GENERATION.md         # دليل توليد APK
└── tsconfig.json             # إعدادات TypeScript
```

## 🔐 الأمان

### التشفير

- **الخوارزمية**: AES-256-GCM
- **حجم المفتاح**: 256 بت
- **حجم IV**: 128 بت
- **حجم Tag**: 128 بت
- **المفاتيح**: فريدة لكل جهاز

### حماية الأوامر

```typescript
// الأوامر المحظورة
- rm -rf /
- mkfs
- format
- dd if=/dev/zero

// الكلمات المفتاحية المحظورة
- rm -rf
- delete
- passwd
- sudo
```

## 📡 API

### تسجيل جهاز

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

### الاتصال الدوري

```http
POST /api/clients/checkin
Content-Type: application/json

{
  "deviceId": "device-uuid",
  "encryptedData": "iv:tag:encrypted"
}
```

### إرسال أمر

```http
POST /api/commands
Content-Type: application/json

{
  "deviceId": "device-uuid",
  "type": "get_system_info",
  "payload": {}
}
```

### الحصول على الأجهزة

```http
GET /api/devices
```

### الحصول على السجلات

```http
GET /api/logs/:deviceId
```

## 🎮 أنواع الأوامر

| النوع | الوصف |
|-------|-------|
| `get_system_info` | معلومات النظام |
| `get_location` | الموقع الجغرافي |
| `get_logs` | السجلات |
| `execute_shell` | تنفيذ أمر shell |
| `run_script` | تشغيل سكريبت |
| `list_files` | قائمة الملفات |
| `read_file` | قراءة ملف |
| `take_screenshot` | لقطة شاشة |
| `ping` | اختبار الاتصال |
| `sync` | مزامنة |

## 📊 الإحصائيات

| المقياس | القيمة |
|--------|--------|
| عدد الملفات | 15+ |
| عدد أسطر الكود | 2000+ |
| عدد API Endpoints | 10+ |
| أنواع الأوامر | 10+ |
| مستوى التشفير | 256-bit |
| فترة الاتصال | 30 ثانية |

## 📚 الملفات الموثقة

- **COMPLETE_PROJECT.md** - الملف الشامل الكامل (800+ سطر)
- **README.md** - دليل شامل عن المشروع
- **QUICK_START.md** - دليل البدء السريع
- **API_DOCUMENTATION.md** - توثيق API كامل
- **APK_GENERATION.md** - دليل توليد APK

## 🛠️ التقنيات المستخدمة

- **Node.js** - بيئة التشغيل
- **Express.js** - إطار العمل
- **TypeScript** - لغة البرمجة
- **Axios** - عميل HTTP
- **Crypto** - التشفير
- **CORS** - معالجة الطلبات المتقاطعة
- **REST API** - واجهة البرنامج

## 🔄 دورة الاتصال

```
العميل                    الخادم
  |                        |
  |--- POST /register ---->|
  |<--- deviceId + key ----|
  |                        |
  |--- POST /checkin ----->| (كل 30 ثانية)
  |<--- الأوامر ----------|
  |                        |
  |--- POST /report ------>|
  |<--- تأكيد ------------|
```

## 🚀 الميزات المتقدمة

### 1. التشفير من طرف إلى طرف
- جميع الاتصالات مشفرة
- مفاتيح فريدة لكل جهاز
- التحقق من السلامة

### 2. خدمة خلفية مستمرة
- اتصال دوري تلقائي
- معالجة الأوامر الفورية
- تقارير دورية

### 3. أوامر آمنة
- حظر الأوامر الخطرة
- التحقق من الكلمات المفتاحية
- انتهاء صلاحية الأوامر

### 4. معلومات شاملة
- معلومات النظام
- الموقع الجغرافي
- السجلات والأحداث
- حالة البطارية

## 📖 الدعم والمساعدة

- 📘 [اقرأ الدليل الشامل](COMPLETE_PROJECT.md)
- 🚀 [ابدأ بسرعة](QUICK_START.md)
- 📡 [توثيق API](API_DOCUMENTATION.md)
- 📱 [دليل توليد APK](APK_GENERATION.md)

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:

1. Fork المشروع
2. إنشاء فرع للميزة الجديدة
3. Commit التغييرات
4. Push إلى الفرع
5. فتح Pull Request

## 📄 الترخيص

هذا المشروع مرخص تحت MIT License - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## 👥 المطورون

- **Device Tracker Team** - الفريق الرئيسي

## 🙏 شكر وتقدير

شكراً لاستخدامك Device Tracker System!

## 📞 التواصل

- 🐛 [الإبلاغ عن مشكلة](https://github.com/kingebrahimopq-create/device-tracker-system/issues)
- 💬 [النقاشات](https://github.com/kingebrahimopq-create/device-tracker-system/discussions)
- 📧 البريد الإلكتروني: dev@devicetracker.local

---

**آخر تحديث:** 24 فبراير 2026  
**الإصدار:** 1.0.0  
**الحالة:** ✅ جاهز للاستخدام الفوري

<div align="center">

### ⭐ إذا أعجبك المشروع، لا تنسَ إضافة نجمة! ⭐

[GitHub](https://github.com/kingebrahimopq-create/device-tracker-system) • 
[الصفحة الرئيسية](https://kingebrahimopq-create.github.io/device-tracker-system) • 
[الوثائق](COMPLETE_PROJECT.md)

</div>
