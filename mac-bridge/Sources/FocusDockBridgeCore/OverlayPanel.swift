import AppKit
import WebKit

/// A borderless, non-activating floating panel that renders the same `/dock`
/// route as the browser. It never replaces or modifies the system Dock.
public final class OverlayPanel: NSObject, WKNavigationDelegate {
    private let panel: NSPanel
    private let webView: WKWebView
    private let backend: URL
    private var screenObserver: NSObjectProtocol?
    private var retryCount = 0
    private var retryWorkItem: DispatchWorkItem?

    public init(backend: URL) {
        self.backend = backend

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.suppressesIncrementalRendering = false
        self.webView = WKWebView(frame: .zero, configuration: configuration)

        let initialFrame = NSRect(x: 0, y: 0, width: 980, height: 160)
        self.panel = NSPanel(
            contentRect: initialFrame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        super.init()

        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]
        webView.underPageBackgroundColor = .clear
        webView.allowsMagnification = false

        panel.contentView = webView
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.hidesOnDeactivate = false
        panel.isMovable = false
        panel.isReleasedWhenClosed = false
        panel.ignoresMouseEvents = false
        panel.animationBehavior = .none

        screenObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.position()
        }

        position()
        load()
    }

    deinit {
        if let screenObserver {
            NotificationCenter.default.removeObserver(screenObserver)
        }
    }

    public func show() {
        position()
        panel.orderFrontRegardless()
    }

    public func hide() {
        panel.orderOut(nil)
    }

    public func toggle() {
        if panel.isVisible {
            hide()
        } else {
            show()
        }
    }

    public func close() {
        retryWorkItem?.cancel()
        webView.stopLoading()
        webView.navigationDelegate = nil
        panel.orderOut(nil)
        panel.close()
        if let screenObserver {
            NotificationCenter.default.removeObserver(screenObserver)
            self.screenObserver = nil
        }
    }

    private func position() {
        guard let screen = NSScreen.main else { return }
        let visible = screen.visibleFrame
        let width = min(980, max(640, visible.width - 48))
        let height: CGFloat = 170
        let x = visible.midX - width / 2
        let y = visible.minY + 12
        panel.setFrame(NSRect(x: x, y: y, width: width, height: height), display: true)
    }

    private func load() {
        let url = backend.appendingPathComponent("dock")
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        webView.load(request)
    }

    // MARK: - WKNavigationDelegate

    public func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if BridgePolicy.isAllowedNavigation(url, backend: backend) {
            decisionHandler(.allow)
        } else {
            fputs("FocusDockBridge: blocked navigation to \(url.host ?? "unknown")\n", stderr)
            decisionHandler(.cancel)
        }
    }

    public func webView(
        _ webView: WKWebView,
        didFinish navigation: WKNavigation!
    ) {
        retryCount = 0
    }

    public func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        scheduleRetry()
    }

    public func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        scheduleRetry()
    }

    private func scheduleRetry() {
        guard retryCount < 10 else { return }
        retryCount += 1
        retryWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.load()
        }
        retryWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: work)
    }
}
