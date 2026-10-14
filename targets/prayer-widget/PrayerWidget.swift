import ActivityKit
import SwiftUI
import WidgetKit

private let appGroup = "group.com.litxtech.namazim"

struct PrayerSlot: Codable {
  let key: String
  let name: String
  let epoch: Double
  let time: String
}

struct PrayerSnapshot: Codable {
  let city: String
  let hijri: String
  let slots: [PrayerSlot]
  let nextName: String
  let nextTime: String
  let nextEpoch: Double
}

struct PrayerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var prayerName: String
    var prayerTime: String
    var endsAt: Date
  }

  var city: String
  var prayerKey: String
}

struct PrayerEntry: TimelineEntry {
  let date: Date
  let snapshot: PrayerSnapshot?
}

private func loadSnapshot() -> PrayerSnapshot? {
  guard let defaults = UserDefaults(suiteName: appGroup),
        let raw = defaults.string(forKey: "snapshot"),
        let data = raw.data(using: .utf8) else {
    return nil
  }
  return try? JSONDecoder().decode(PrayerSnapshot.self, from: data)
}

private func nextSlot(in snapshot: PrayerSnapshot, after date: Date) -> PrayerSlot? {
  snapshot.slots.first { $0.epoch > date.timeIntervalSince1970 }
}

private struct Palette {
  let background: Color
  let text: Color
  let accent: Color

  static func current(_ scheme: ColorScheme) -> Palette {
    if scheme == .dark {
      return Palette(
        background: Color(red: 0.098, green: 0.106, blue: 0.141),
        text: Color(red: 0.969, green: 0.969, blue: 0.980),
        accent: Color(red: 0.651, green: 0.361, blue: 0.839)
      )
    }
    return Palette(
      background: Color(red: 0.973, green: 0.973, blue: 0.988),
      text: Color(red: 0.125, green: 0.129, blue: 0.169),
      accent: Color(red: 0.529, green: 0.271, blue: 0.741)
    )
  }
}

struct PrayerHomeWidget: Widget {
  let kind = "PrayerWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: PrayerProvider()) { entry in
      PrayerWidgetView(entry: entry)
    }
    .configurationDisplayName("SAFDAŞ")
    .description("Sıradaki namaz ve günlük vakitler")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct PrayerProvider: TimelineProvider {
  func placeholder(in context: Context) -> PrayerEntry {
    PrayerEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
    completion(PrayerEntry(date: Date(), snapshot: loadSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
    let snapshot = loadSnapshot()
    let now = Date()
    var dates = [now]
    if let snapshot {
      dates.append(contentsOf: snapshot.slots.map { Date(timeIntervalSince1970: $0.epoch) }.filter { $0 > now })
    }
    let entries = dates.map { PrayerEntry(date: $0, snapshot: snapshot) }
    let refresh = dates.last?.addingTimeInterval(60) ?? now.addingTimeInterval(6 * 60 * 60)
    completion(Timeline(entries: entries, policy: .after(refresh)))
  }
}

struct PrayerWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme
  var entry: PrayerEntry

  var body: some View {
    let palette = Palette.current(scheme)
    content(palette)
      .widgetURL(URL(string: "safdas://prayer"))
      .containerBackground(usesColor ? palette.background : Color.clear, for: .widget)
  }

  private var usesColor: Bool {
    family == .systemSmall || family == .systemMedium || family == .systemLarge
  }

  @ViewBuilder
  private func content(_ palette: Palette) -> some View {
    if let snapshot = entry.snapshot {
      switch family {
      case .systemMedium:
        medium(snapshot, palette)
      case .systemLarge:
        large(snapshot, palette)
      case .accessoryInline:
        inline(snapshot)
      case .accessoryCircular:
        circular(snapshot)
      case .accessoryRectangular:
        rectangular(snapshot)
      default:
        small(snapshot, palette)
      }
    } else {
      Text("SAFDAŞ")
        .font(family == .accessoryInline ? .caption : .headline)
    }
  }

  private func upcoming(_ snapshot: PrayerSnapshot) -> PrayerSlot? {
    nextSlot(in: snapshot, after: entry.date)
  }

  private func countdown(_ snapshot: PrayerSnapshot, _ palette: Palette) -> some View {
    if let next = upcoming(snapshot) {
      let end = Date(timeIntervalSince1970: next.epoch)
      if end > entry.date {
        Text(timerInterval: entry.date...end, countsDown: true)
          .monospacedDigit()
          .foregroundStyle(palette.accent)
          .minimumScaleFactor(0.6)
      } else {
        Text(next.time).foregroundStyle(palette.accent)
      }
    } else {
      Text("--:--").foregroundStyle(palette.accent)
    }
  }

  private func small(_ snapshot: PrayerSnapshot, _ palette: Palette) -> some View {
    let next = upcoming(snapshot)
    return VStack(alignment: .leading, spacing: 4) {
      Text("SAFDAŞ").font(.caption.weight(.bold)).foregroundStyle(palette.accent)
      Text(next?.name ?? snapshot.nextName).font(.headline).foregroundStyle(palette.text).lineLimit(1)
      Text(next?.time ?? snapshot.nextTime).font(.title3.weight(.semibold)).foregroundStyle(palette.text)
      countdown(snapshot, palette)
      Text(snapshot.city).font(.caption).foregroundStyle(palette.text.opacity(0.75)).lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  private func daySlots(_ snapshot: PrayerSnapshot) -> [PrayerSlot] {
    let focus = upcoming(snapshot) ?? snapshot.slots.last
    let day = Date(timeIntervalSince1970: focus?.epoch ?? entry.date.timeIntervalSince1970)
    let sameDay = snapshot.slots.filter {
      Calendar.current.isDate(Date(timeIntervalSince1970: $0.epoch), inSameDayAs: day)
    }
    return sameDay.isEmpty ? snapshot.slots : sameDay
  }

  private func slotList(_ snapshot: PrayerSnapshot, _ palette: Palette) -> some View {
    let next = upcoming(snapshot)
    return VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(daySlots(snapshot).enumerated()), id: \.offset) { _, slot in
        HStack {
          Text(slot.name).foregroundStyle(slot.epoch == next?.epoch ? palette.accent : palette.text)
          Spacer()
          Text(slot.time).monospacedDigit().foregroundStyle(palette.text)
        }
        .font(.subheadline)
      }
    }
  }

  private func medium(_ snapshot: PrayerSnapshot, _ palette: Palette) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("SAFDAŞ").font(.caption.weight(.bold)).foregroundStyle(palette.accent)
        Spacer()
        Text(snapshot.city).font(.caption).foregroundStyle(palette.text.opacity(0.75))
      }
      slotList(snapshot, palette)
    }
  }

  private func large(_ snapshot: PrayerSnapshot, _ palette: Palette) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Image("logo").resizable().frame(width: 28, height: 28)
        VStack(alignment: .leading) {
          Text("SAFDAŞ").font(.headline).foregroundStyle(palette.accent)
          Text(snapshot.city).font(.subheadline).foregroundStyle(palette.text)
        }
        Spacer()
        countdown(snapshot, palette)
      }
      if !snapshot.hijri.isEmpty {
        Text(snapshot.hijri).font(.caption).foregroundStyle(palette.text.opacity(0.75))
      }
      slotList(snapshot, palette)
    }
  }

  private func inline(_ snapshot: PrayerSnapshot) -> some View {
    let next = upcoming(snapshot)
    Text("\(next?.name ?? snapshot.nextName) \(next?.time ?? snapshot.nextTime)")
  }

  private func circular(_ snapshot: PrayerSnapshot) -> some View {
    let next = upcoming(snapshot)
    VStack(spacing: 0) {
      Text(next?.time ?? snapshot.nextTime).font(.caption.weight(.bold)).minimumScaleFactor(0.5)
    }
  }

  private func rectangular(_ snapshot: PrayerSnapshot) -> some View {
    let next = upcoming(snapshot)
    VStack(alignment: .leading, spacing: 2) {
      Text(next?.name ?? snapshot.nextName).font(.headline)
      Text(next?.time ?? snapshot.nextTime).font(.caption)
      Text(snapshot.city).font(.caption2)
    }
  }
}

struct PrayerLiveWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Image("logo").resizable().frame(width: 22, height: 22)
          Text("SAFDAŞ").font(.headline).foregroundStyle(Color(red: 0.651, green: 0.361, blue: 0.839))
          Spacer()
          Text(context.attributes.city).font(.caption)
        }
        Text(context.state.prayerName).font(.title3.weight(.semibold))
        HStack {
          Text(context.state.prayerTime).monospacedDigit()
          Spacer()
          if context.state.endsAt > Date() {
            Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
              .monospacedDigit()
          }
        }
      }
      .padding(.horizontal, 4)
      .activityBackgroundTint(Color(red: 0.098, green: 0.106, blue: 0.141))
      .activitySystemActionForegroundColor(Color(red: 0.651, green: 0.361, blue: 0.839))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image("logo").resizable().frame(width: 22, height: 22)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(context.state.prayerTime).monospacedDigit()
        }
        DynamicIslandExpandedRegion(.center) {
          Text("SAFDAŞ").font(.caption.weight(.bold)).foregroundStyle(Color(red: 0.651, green: 0.361, blue: 0.839))
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(context.state.prayerName)
            Spacer()
            if context.state.endsAt > Date() {
              Text(timerInterval: Date()...context.state.endsAt, countsDown: true).monospacedDigit()
            }
          }
        }
      } compactLeading: {
        Image("logo").resizable().frame(width: 16, height: 16)
      } compactTrailing: {
        if context.state.endsAt > Date() {
          Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
            .monospacedDigit()
            .frame(maxWidth: 56)
        } else {
          Text(context.state.prayerTime)
        }
      } minimal: {
        Image("logo").resizable().frame(width: 12, height: 12)
      }
      .keylineTint(Color(red: 0.651, green: 0.361, blue: 0.839))
    }
  }
}

@main
struct SafdasWidgets: WidgetBundle {
  var body: some Widget {
    PrayerHomeWidget()
    PrayerLiveWidget()
  }
}
