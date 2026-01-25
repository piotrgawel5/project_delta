Pod::Spec.new do |s|
  s.name           = 'HealthConnect'
  s.version        = '1.0.0'
  s.summary        = 'Health Connect module for Expo (iOS placeholder)'
  s.description    = 'Placeholder module for Health Connect on iOS. Full implementation requires Apple HealthKit.'
  s.author         = 'Project Delta'
  s.homepage       = 'https://github.com/project-delta'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
end
