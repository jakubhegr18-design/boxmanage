// Router-aware navigace. V prohlížeči používá history API, v nativní Capacitor
// aplikaci router (window.location by v WebViewu rozbil relativní cesty).
let navigateFn = null;

export function setNavigator(fn) {
  navigateFn = fn;
}

export function navigate(path) {
  if (navigateFn) navigateFn(path);
  else window.location.href = path;
}
