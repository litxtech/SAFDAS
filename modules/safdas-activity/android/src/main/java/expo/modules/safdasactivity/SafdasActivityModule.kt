package expo.modules.safdasactivity

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SafdasActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafdasActivity")

    Function("publishWidgetSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@Function null
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SNAPSHOT, json).apply()
      val intent = Intent(context, PrayerWidgetProvider::class.java).apply { action = REFRESH }
      context.sendBroadcast(intent)
      null
    }

    Function("isLiveActivityAvailable") { false }

    Function("canScheduleExactAlarms") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarm.canScheduleExactAlarms()
    }

    Function("openExactAlarmSettings") {
      val context = appContext.reactContext ?: return@Function null
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function null
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      null
    }

    AsyncFunction("start") { city: String, prayerKey: String, prayerName: String, prayerTime: String, endsAt: Double ->
      listOf(city, prayerKey, prayerName, prayerTime, endsAt).let { false }
    }

    AsyncFunction("end") {
      false
    }
  }

  companion object {
    const val PREFS = "safdas_widget"
    const val SNAPSHOT = "snapshot"
    const val REFRESH = "com.litxtech.namazim.WIDGET_REFRESH"
  }
}
