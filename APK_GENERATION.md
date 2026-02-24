# نظام توليد APK للعميل

## نظرة عامة

يتم توليد APK مخصص لكل جهاز يحتوي على:
- معرف الجهاز الفريد
- مفتاح التشفير الخاص به
- عنوان الخادم
- إعدادات الاتصال المخصصة

## المتطلبات

- Android SDK
- Java Development Kit (JDK) 11+
- Node.js 14+
- React Native CLI
- Gradle

## خطوات التثبيت

### 1. تثبيت Android SDK

```bash
# على macOS
brew install android-sdk

# على Linux
sudo apt-get install android-sdk

# على Windows
# قم بتحميل من https://developer.android.com/studio
```

### 2. تثبيت Java JDK

```bash
# على macOS
brew install openjdk@11

# على Linux
sudo apt-get install openjdk-11-jdk

# على Windows
# قم بتحميل من https://www.oracle.com/java/technologies/downloads/
```

### 3. تثبيت React Native CLI

```bash
npm install -g react-native-cli
npm install -g expo-cli
```

## عملية توليد APK

### الخطوة 1: إنشاء مشروع React Native جديد

```bash
# إنشاء مشروع جديد
npx react-native init DeviceTrackerClient

cd DeviceTrackerClient
```

### الخطوة 2: إضافة الملفات المخصصة

```bash
# نسخ ملفات العميل
cp ../client-app/client-service.ts ./src/
cp ../client-app/index.ts ./src/

# تثبيت المكتبات المطلوبة
npm install axios
npm install react-native-background-task
npm install react-native-geolocation-service
npm install react-native-fs
```

### الخطوة 3: تكوين معرف الجهاز والمفتاح

إنشاء ملف `src/config.ts`:

```typescript
export const DEVICE_CONFIG = {
  deviceId: 'DEVICE_ID_HERE',
  encryptionKey: 'ENCRYPTION_KEY_HERE',
  clientId: 'CLIENT_ID_HERE',
  serverUrl: 'SERVER_URL_HERE',
  checkInInterval: 30,
};
```

### الخطوة 4: تحديث `android/app/build.gradle`

```gradle
android {
  compileSdkVersion 31
  
  defaultConfig {
    applicationId "com.devicetracker.client"
    minSdkVersion 21
    targetSdkVersion 31
    versionCode 1
    versionName "1.0.0"
  }
  
  buildTypes {
    release {
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

### الخطوة 5: إضافة الأذونات

تحديث `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.devicetracker.client">

    <!-- الأذونات المطلوبة -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.READ_LOGS" />
    <uses-permission android:name="android.permission.GET_TASKS" />
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    
    <application>
        <!-- الأنشطة والخدمات -->
    </application>
</manifest>
```

### الخطوة 6: بناء APK

```bash
# بناء APK للتطوير
npm run android

# بناء APK للإنتاج (موقع)
cd android
./gradlew assembleRelease
cd ..

# سيتم إنشاء APK في:
# android/app/build/outputs/apk/release/app-release.apk
```

### الخطوة 7: توقيع APK

```bash
# إنشاء keystore
keytool -genkey -v -keystore my-release-key.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias my-key-alias

# توقيع APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore my-release-key.keystore \
  android/app/build/outputs/apk/release/app-release.apk \
  my-key-alias

# تحسين APK
zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release.apk \
  app-release-aligned.apk
```

## نظام التوليد التلقائي

### من خلال تطبيق الإدارة

1. اذهب إلى قسم "توليد APK جديد"
2. أدخل اسم الجهاز
3. اختر الإعدادات:
   - فترة الاتصال (افتراضي: 30 ثانية)
   - تفعيل GPS
   - تفعيل التقاط الشاشة
4. اضغط "توليد APK"
5. سيتم تحميل APK تلقائياً

### البيانات المضمنة في APK

```json
{
  "deviceId": "uuid-unique-id",
  "encryptionKey": "hex-encoded-key",
  "clientId": "client-unique-id",
  "serverUrl": "https://server.example.com",
  "checkInInterval": 30,
  "features": {
    "gps": true,
    "screenshot": true,
    "logs": true,
    "systemInfo": true
  },
  "buildTime": "2024-02-24T12:00:00Z",
  "version": "1.0.0"
}
```

## التثبيت على الجهاز

### عبر USB

```bash
# توصيل الجهاز عبر USB
adb devices

# تثبيت APK
adb install app-release.apk

# تشغيل التطبيق
adb shell am start -n com.devicetracker.client/.MainActivity
```

### عبر QR Code

1. عرض QR Code في تطبيق الإدارة
2. مسح QR Code من الجهاز
3. سيتم تحميل وتثبيت APK تلقائياً

### عبر رابط مباشر

```bash
# إنشاء رابط تحميل
https://server.example.com/download/apk/{deviceId}

# أو عبر QR Code
https://server.example.com/qr/{deviceId}
```

## الخدمة في الخلفية

### تفعيل الخدمة في الخلفية

```typescript
// في MainActivity.java
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public class ClientService extends Service {
  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    // بدء خدمة الاتصال الدورية
    startClientCheckIn();
    return START_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
```

### البقاء نشطاً عند إعادة التشغيل

```xml
<!-- في AndroidManifest.xml -->
<receiver android:name=".BootReceiver">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED" />
  </intent-filter>
</receiver>
```

## الأمان

### التوقيع الرقمي

```bash
# التحقق من توقيع APK
jarsigner -verify -verbose -certs app-release.apk
```

### حماية الكود

```bash
# تفعيل ProGuard
android {
  buildTypes {
    release {
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

### حماية البيانات المضمنة

- تشفير معرف الجهاز
- تشفير مفتاح التشفير
- حماية البيانات المحفوظة محلياً

## استكشاف الأخطاء

### المشكلة: فشل البناء

```bash
# تنظيف المشروع
npm run android -- --clean

# إعادة تثبيت المكتبات
npm install

# محاولة البناء مرة أخرى
npm run android
```

### المشكلة: APK لا يعمل

```bash
# عرض السجلات
adb logcat | grep DeviceTracker

# التحقق من الأذونات
adb shell pm list permissions -g

# إعادة تثبيت APK
adb uninstall com.devicetracker.client
adb install app-release.apk
```

### المشكلة: الخدمة لا تعمل في الخلفية

```bash
# التحقق من حالة الخدمة
adb shell dumpsys activity services

# تفعيل الخدمة يدويًا
adb shell am startservice com.devicetracker.client/.ClientService
```

## الإصدارات والتحديثات

### إنشاء إصدار جديد

```bash
# تحديث رقم الإصدار في build.gradle
versionCode 2
versionName "1.1.0"

# بناء الإصدار الجديد
npm run android -- --release
```

### التحديث التلقائي

العميل سيتحقق من التحديثات تلقائياً كل ساعة:

```typescript
// في client-service.ts
async checkForUpdates() {
  const response = await this.axiosInstance.get('/api/client/version');
  if (response.data.version > CURRENT_VERSION) {
    // تحميل وتثبيت التحديث
    await this.downloadAndInstallUpdate(response.data.downloadUrl);
  }
}
```

## الأداء والتحسينات

### تقليل استهلاك البطارية

```typescript
// تقليل فترة الاتصال عندما تكون البطارية منخفضة
if (batteryLevel < 20) {
  checkInInterval = 60; // دقيقة واحدة بدلاً من 30 ثانية
}
```

### تقليل استهلاك البيانات

```typescript
// ضغط البيانات المرسلة
const compressedData = gzip(JSON.stringify(data));
```

### تحسين الأداء

```typescript
// استخدام Web Workers
const worker = new Worker('background-worker.js');
worker.postMessage(data);
```

---

**ملاحظة:** هذا الدليل يوضح العملية الأساسية. قد تختلف التفاصيل حسب الإصدار والبيئة.
