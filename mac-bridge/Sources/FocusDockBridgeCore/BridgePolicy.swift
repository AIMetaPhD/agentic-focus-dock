import Foundation

/// The bridge deliberately has a very small surface:
/// - it may only talk to a loopback HTTP backend;
/// - the embedded WebView may only navigate to the dock shell and its assets;
/// - it does not expose any shell, AppleScript, or arbitrary-app action API.
public enum BridgePolicy {
    public static let allowedHosts: Set<String> = ["127.0.0.1", "localhost", "::1"]

    public static func isAllowedBackend(_ url: URL) -> Bool {
        guard url.scheme == "http", let host = url.host else { return false }
        return allowedHosts.contains(host) && url.port != nil
    }

    public static func isAllowedNavigation(_ url: URL, backend: URL) -> Bool {
        guard url.scheme == backend.scheme,
              url.host == backend.host,
              url.port == backend.port
        else { return false }

        let path = url.path
        if path == "/" || path == "/dock" || path == "/favicon.ico" { return true }
        return path.hasPrefix("/assets/")
    }

    public static let capabilities: [String: String] = [
        "overlay": "nspanel-wkwebview",
        "activity": "nsworkspace",
        "notifications": "unsupported",
        "system_dock": "untouched",
    ]
}
