/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'widget',
  name: 'PrayerWidget',
  displayName: 'SAFDAŞ',
  bundleIdentifier: '.prayerwidget',
  deploymentTarget: '17.0',
  icon: '../../assets/icon.png',
  images: {
    logo: '../../assets/logo-mark.png',
  },
  colors: {
    $accent: '#A65CD6',
    $widgetBackground: { light: '#F8F8FC', dark: '#191B24' },
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.litxtech.namazim'],
  },
});
