import ExpoModulesCore
import ActivityKit

struct PrayerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var prayerName: String
    var prayerTime: String
    var endsAt: Date
  }

  var city: String
  var prayerKey: String
}

public class SafdasActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SafdasActivity")

    Function("publishWidgetSnapshot") { (_: String) in
      // iOS widget verisi App Group üzerinden yazılır.
    }

    Function("isLiveActivityAvailable") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    Function("canScheduleExactAlarms") { () -> Bool in
      true
    }

    Function("openExactAlarmSettings") {
      // Kesin alarm ayarı Android'e aittir.
    }

    AsyncFunction("start") { (city: String, prayerKey: String, prayerName: String, prayerTime: String, endsAt: Double, promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.resolve(false)
        return
      }
      Task { @MainActor in
        let started = await Self.startActivity(city: city, prayerKey: prayerKey, prayerName: prayerName, prayerTime: prayerTime, endsAt: endsAt)
        promise.resolve(started)
      }
    }

    AsyncFunction("end") { (promise: Promise) in
      guard #available(iOS 16.2, *) else {
        promise.resolve(false)
        return
      }
      Task { @MainActor in
        for activity in Activity<PrayerActivityAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
        promise.resolve(true)
      }
    }
  }

  @available(iOS 16.2, *)
  @MainActor
  private static func startActivity(city: String, prayerKey: String, prayerName: String, prayerTime: String, endsAt: Double) async -> Bool {
    let end = Date(timeIntervalSince1970: endsAt / 1000)
    guard ActivityAuthorizationInfo().areActivitiesEnabled, end > Date() else {
      return false
    }
    let state = PrayerActivityAttributes.ContentState(prayerName: prayerName, prayerTime: prayerTime, endsAt: end)
    let content = ActivityContent(state: state, staleDate: end)
    do {
      for activity in Activity<PrayerActivityAttributes>.activities where activity.attributes.prayerKey != prayerKey {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      if let current = Activity<PrayerActivityAttributes>.activities.first(where: { $0.attributes.prayerKey == prayerKey }) {
        await current.update(content)
        return true
      }
      let attributes = PrayerActivityAttributes(city: city, prayerKey: prayerKey)
      _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
      return true
    } catch {
      return false
    }
  }
}
