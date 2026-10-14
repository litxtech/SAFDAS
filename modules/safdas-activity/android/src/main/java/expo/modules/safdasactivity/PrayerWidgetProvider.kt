package expo.modules.safdasactivity

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import org.json.JSONObject

class PrayerWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { updateWidget(context, manager, it) }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == SafdasActivityModule.REFRESH) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PrayerWidgetProvider::class.java))
      onUpdate(context, manager, ids)
    }
  }

  companion object {
    fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.safdas_prayer_widget)
      val raw = context.getSharedPreferences(SafdasActivityModule.PREFS, Context.MODE_PRIVATE)
        .getString(SafdasActivityModule.SNAPSHOT, null)
      val snapshot = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
      val dark = snapshot?.optString("theme") != "light"
      val background = Color.parseColor(if (dark) "#191B24" else "#F8F8FC")
      val text = Color.parseColor(if (dark) "#F7F7FA" else "#20212B")
      val accent = Color.parseColor(if (dark) "#A65CD6" else "#8745BD")
      views.setInt(R.id.widget_root, "setBackgroundColor", background)
      views.setTextColor(R.id.widget_brand, accent)
      views.setTextColor(R.id.widget_city, text)
      views.setTextColor(R.id.widget_next, text)
      views.setTextColor(R.id.widget_time, accent)
      views.setTextColor(R.id.widget_remaining, text)
      views.setTextColor(R.id.widget_times, text)
      views.setTextViewText(R.id.widget_brand, "SAFDAŞ")
      views.setTextViewText(R.id.widget_city, snapshot?.optString("city").orEmpty())
      views.setTextViewText(R.id.widget_next, snapshot?.optString("nextName") ?: "SAFDAŞ")
      views.setTextViewText(R.id.widget_time, snapshot?.optString("nextTime") ?: "--:--")
      views.setTextViewText(R.id.widget_remaining, snapshot?.optString("remaining") ?: "")
      views.setTextViewText(R.id.widget_times, snapshot?.optString("timesLine") ?: "")

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        data = android.net.Uri.parse("safdas://prayer")
      }
      if (launch != null) {
        val pending = PendingIntent.getActivity(
          context,
          0,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_root, pending)
      }
      manager.updateAppWidget(id, views)
    }
  }
}
