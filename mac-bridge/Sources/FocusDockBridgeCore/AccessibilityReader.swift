import ApplicationServices
import Foundation

/// Reads only the focused window title, and only when the user granted
/// Accessibility. Without permission every call returns nil; the bridge then
/// reports bundle ids and app names only.
public enum AccessibilityReader {
    public static var status: String {
        AXIsProcessTrusted() ? "granted" : "denied"
    }

    public static func requestIfNeeded() {
        // The raw key avoids importing an SDK symbol whose Swift type has
        // changed across Xcode releases. Value matches kAXTrustedCheckOptionPrompt.
        let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    public static func focusedWindowTitle(pid: pid_t) -> String? {
        guard AXIsProcessTrusted() else { return nil }
        let app = AXUIElementCreateApplication(pid)
        var focused: CFTypeRef?
        let focusedResult = AXUIElementCopyAttributeValue(
            app,
            kAXFocusedWindowAttribute as CFString,
            &focused
        )
        guard focusedResult == .success, let focused else { return nil }
        guard CFGetTypeID(focused) == AXUIElementGetTypeID() else { return nil }
        let window = unsafeBitCast(focused, to: AXUIElement.self)

        var title: CFTypeRef?
        let titleResult = AXUIElementCopyAttributeValue(
            window,
            kAXTitleAttribute as CFString,
            &title
        )
        guard titleResult == .success, let title else { return nil }
        return title as? String
    }
}
