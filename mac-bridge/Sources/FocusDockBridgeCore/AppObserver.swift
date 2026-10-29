import AppKit
import Foundation

/// Observes frontmost-app changes with the public NSWorkspace API.
///
/// It reports two events per stable app: one immediately (stable_seconds 0,
/// which the server treats as "hold") and one after the 15 s dwell time. Quick
/// alt-tabs cancel the dwell timer, so the rules engine does not flap modes.
public final class AppObserver {
    private let client: BridgeClient
    private let includeTitles: Bool
    private var observers: [NSObjectProtocol] = []
    private var dwellWorkItem: DispatchWorkItem?
    private var immediateWorkItem: DispatchWorkItem?
    private var currentPid: pid_t?
    private var currentBundleId: String?
    private var currentSince: Date?
    private let dwellSeconds: Double = 15

    public init(client: BridgeClient, includeTitles: Bool) {
        self.client = client
        self.includeTitles = includeTitles
    }

    public func start() {
        let center = NSWorkspace.shared.notificationCenter
        let activation = center.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard
                let self,
                let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            else { return }
            self.handle(app)
        }
        observers.append(activation)

        if let frontmost = NSWorkspace.shared.frontmostApplication {
            handle(frontmost)
        }
    }

    public func stop() {
        let center = NSWorkspace.shared.notificationCenter
        for observer in observers { center.removeObserver(observer) }
        observers.removeAll()
        dwellWorkItem?.cancel()
        immediateWorkItem?.cancel()
    }

    private func handle(_ app: NSRunningApplication) {
        let bundleId = app.bundleIdentifier
        let name = app.localizedName ?? bundleId ?? "Unknown"
        let pid = app.processIdentifier

        if currentPid == pid, currentBundleId == bundleId { return }

        currentPid = pid
        currentBundleId = bundleId
        currentSince = Date()

        dwellWorkItem?.cancel()
        immediateWorkItem?.cancel()

        let immediate = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.emit(app: app, name: name, bundleId: bundleId, stable: 0)
        }
        immediateWorkItem = immediate
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: immediate)

        let dwell = DispatchWorkItem { [weak self] in
            guard let self, self.currentPid == pid else { return }
            self.emit(app: app, name: name, bundleId: bundleId, stable: self.dwellSeconds)
        }
        dwellWorkItem = dwell
        DispatchQueue.main.asyncAfter(deadline: .now() + dwellSeconds, execute: dwell)
    }

    private func emit(
        app: NSRunningApplication,
        name: String,
        bundleId: String?,
        stable: Double
    ) {
        let title: String? = includeTitles
            ? AccessibilityReader.focusedWindowTitle(pid: app.processIdentifier)
            : nil
        // Capture immutable values before crossing into the concurrency domain.
        let capturedBundleId = bundleId
        Task {
            await client.activity(
                appId: capturedBundleId,
                appName: name,
                windowTitle: title,
                stableSeconds: stable
            )
        }
    }
}
