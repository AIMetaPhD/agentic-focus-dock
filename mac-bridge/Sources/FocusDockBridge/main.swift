import AppKit
import Darwin
import FocusDockBridgeCore

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var panel: OverlayPanel?
    private var observer: AppObserver?
    private var client: BridgeClient?
    private var heartbeat: Timer?
    private var statusItem: NSStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            let config = try BridgeConfig.parse(arguments: Array(CommandLine.arguments.dropFirst()))
            let token = try config.readToken()
            let client = BridgeClient(backend: config.backend, token: token)
            self.client = client

            if config.withWindowTitles {
                AccessibilityReader.requestIfNeeded()
            }

            let panel = OverlayPanel(backend: config.backend)
            panel.show()
            self.panel = panel

            let observer = AppObserver(client: client, includeTitles: config.withWindowTitles)
            observer.start()
            self.observer = observer

            sendHeartbeat()
            let timer = Timer(timeInterval: 10, repeats: true) { [weak self] _ in
                self?.sendHeartbeat()
            }
            RunLoop.main.add(timer, forMode: .common)
            heartbeat = timer

            setupStatusItem()
        } catch {
            fputs("FocusDockBridge: \(error)\n", stderr)
            NSApp.terminate(nil)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        heartbeat?.invalidate()
        observer?.stop()
        panel?.close()
        client?.disconnectSync()
    }

    private func sendHeartbeat() {
        let status = AccessibilityReader.status
        Task { [weak self] in
            await self?.client?.heartbeat(accessibility: status)
        }
    }

    private func setupStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "◎"
        item.button?.toolTip = "FocusDock Bridge"

        let menu = NSMenu()
        let show = NSMenuItem(title: "Show Focus Dock", action: #selector(togglePanel), keyEquivalent: "d")
        show.target = self
        menu.addItem(show)
        menu.addItem(NSMenuItem.separator())
        let quit = NSMenuItem(title: "Quit FocusDock Bridge", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        item.menu = menu
        statusItem = item
    }

    @objc private func togglePanel() {
        panel?.toggle()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
_ = application.setActivationPolicy(.accessory)

signal(SIGINT, SIG_IGN)
let interrupt = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
interrupt.setEventHandler {
    NSApp.terminate(nil)
}
interrupt.resume()

application.run()
