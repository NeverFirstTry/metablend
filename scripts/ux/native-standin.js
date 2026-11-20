// Stands in for the phone shell's native bridge, so the pages show what they show inside the app (notification
// settings, plan a hike, app icon). Nothing here is the real system: no permission dialog, no real push.
(() => {
  const k = key => 'cap_' + key
  const listeners = {}
  const fire = (plugin, event, data) => (listeners[plugin + ':' + event] ?? []).forEach(cb => cb(data))
  const H = {
    Preferences: { get: ({ key }) => ({ value: localStorage.getItem(k(key)) }), set: ({ key, value }) => { localStorage.setItem(k(key), value) }, remove: ({ key }) => { localStorage.removeItem(k(key)) }, keys: () => ({ keys: [] }), clear: () => ({}), migrate: () => ({}) },
    PushNotifications: {
      checkPermissions: () => ({ receive: localStorage.getItem('standin_push') ?? 'prompt' }),
      requestPermissions: () => { localStorage.setItem('standin_push', 'granted'); return { receive: 'granted' } },
      register: () => { setTimeout(() => fire('PushNotifications', 'registration', { value: 'ux-review-stand-in-token' }), 60); return {} },
      unregister: () => ({}), getDeliveredNotifications: () => ({ notifications: [] }), removeAllDeliveredNotifications: () => ({}), removeDeliveredNotifications: () => ({}), createChannel: () => ({}), deleteChannel: () => ({}), listChannels: () => ({ channels: [] }), removeAllListeners: () => ({}),
    },
    App: { getInfo: () => ({ name: 'MetaBlend', id: 'app.metablend', build: '1', version: '1.0.0' }), getState: () => ({ isActive: true }), getLaunchUrl: () => ({}), exitApp: () => ({}), minimizeApp: () => ({}), removeAllListeners: () => ({}) },
    Geolocation: { checkPermissions: () => ({ location: 'prompt', coarseLocation: 'prompt' }), requestPermissions: () => ({ location: 'denied', coarseLocation: 'denied' }), getCurrentPosition: () => { throw new Error('Location permission was denied') }, watchPosition: () => ({}), clearWatch: () => ({}) },
    Share: { canShare: () => ({ value: true }), share: () => ({}) },
    Haptics: { impact: () => ({}), notification: () => ({}), vibrate: () => ({}), selectionStart: () => ({}), selectionChanged: () => ({}), selectionEnd: () => ({}) },
    AppLauncher: { canOpenUrl: () => ({ value: true }), openUrl: () => ({ completed: true }) },
    AppIcon: { get: () => ({ name: localStorage.getItem('standin_icon'), platform: 'ios', icons: ['slate', 'glow', 'gold', 'light', 'butter', 'summit', 'weather', 'dots', 'mono', 'winter', 'sky'] }), set: ({ name }) => { localStorage.setItem('standin_icon', name); return {} } },
    AppSettings: { openNotifications: () => ({}) },
    TextScale: { get: () => ({ scale: window.__textScale ?? 1 }), set: () => ({}) },
    WidgetBridge: { sync: () => ({}) },
    StatusBar: { setStyle: () => ({}), setBackgroundColor: () => ({}), show: () => ({}), hide: () => ({}), getInfo: () => ({}), setOverlaysWebView: () => ({}) },
    SplashScreen: { hide: () => ({}), show: () => ({}) },
    Keyboard: { hide: () => ({}), show: () => ({}), setAccessoryBarVisible: () => ({}), setScroll: () => ({}), setStyle: () => ({}), setResizeMode: () => ({}), removeAllListeners: () => ({}) },
    Network: { getStatus: () => ({ connected: true, connectionType: 'wifi' }), removeAllListeners: () => ({}) },
    Browser: { open: () => ({}), close: () => ({}), removeAllListeners: () => ({}) },
  }
  window.__standinCalls = []
  window.Capacitor = {
    PluginHeaders: Object.entries(H).map(([name, m]) => ({ name, methods: [...Object.keys(m).map(n => ({ name: n, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] })),
    nativePromise: (plugin, method, options) => new Promise((resolve, reject) => { window.__standinCalls.push(plugin + '.' + method); try { resolve(H[plugin]?.[method]?.(options ?? {}) ?? {}) } catch (e) { reject(e) } }),
    nativeCallback: (plugin, method, options, cb) => { if (method === 'addListener' && cb) (listeners[plugin + ':' + options.eventName] ??= []).push(cb); return Promise.resolve('standin-' + Math.random().toString(36).slice(2)) },
    isNativePlatform: () => true, getPlatform: () => 'ios', platform: 'ios',
  }
  window.webkit = { messageHandlers: { bridge: { postMessage() {} } } }
})()
