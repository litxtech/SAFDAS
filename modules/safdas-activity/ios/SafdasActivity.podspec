Pod::Spec.new do |s|
  s.name           = 'SafdasActivity'
  s.version        = '1.0.0'
  s.summary        = 'SAFDAS prayer Live Activity'
  s.homepage       = 'https://litxtech.com'
  s.license        = 'MIT'
  s.author         = 'LITXTECH LLC'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'ActivityKit'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
  s.source_files = '**/*.{swift}'
end
