# استخدام صورة Node.js الخفيفة
FROM node:18-alpine

# تعيين مجلد العمل
WORKDIR /app

# نسخ ملفات package.json
COPY package*.json ./

# تثبيت التبعيات
RUN npm install --production

# نسخ الكود المصدري
COPY . .

# تعيين متغيرات البيئة
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# فتح المنفذ
EXPOSE 3000

# تشغيل التطبيق
CMD ["node", "index.js"]
