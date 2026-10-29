import Foundation

public enum BridgeClientError: Error, CustomStringConvertible {
    case http(Int)
    case invalidResponse

    public var description: String {
        switch self {
        case .http(let status): return "backend returned HTTP \(status)"
        case .invalidResponse: return "backend returned an invalid response"
        }
    }
}

/// Small loopback-only client. The token is held in memory, sent only in the
/// Authorization header, and never printed or placed in a URL.
public final class BridgeClient {
    private let backend: URL
    private let token: String
    private let session: URLSession
    private let version = "0.1.0"

    public init(backend: URL, token: String) {
        self.backend = backend
        self.token = token
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        configuration.httpCookieAcceptPolicy = .never
        self.session = URLSession(configuration: configuration)
    }

    private func post(_ path: String, body: [String: Any]) async throws -> Data {
        let url = backend.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BridgeClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw BridgeClientError.http(http.statusCode)
        }
        return data
    }

    public func heartbeat(accessibility: String) async {
        let body: [String: Any] = [
            "bridge_version": version,
            "capabilities": BridgePolicy.capabilities.merging(["accessibility": accessibility]) { _, new in new },
        ]
        do {
            _ = try await post("api/bridge/heartbeat", body: body)
        } catch {
            fputs("FocusDockBridge: heartbeat failed (\(error))\n", stderr)
        }
    }

    public func activity(
        appId: String?,
        appName: String,
        windowTitle: String?,
        stableSeconds: Double
    ) async {
        var payload: [String: Any] = [
            "app_name": appName,
            "stable_seconds": stableSeconds,
        ]
        if let appId { payload["app_id"] = appId }
        if let windowTitle, !windowTitle.isEmpty { payload["title"] = String(windowTitle.prefix(200)) }

        let body: [String: Any] = [
            "kind": "activity",
            "source_app": appName,
            "payload": payload,
        ]
        do {
            _ = try await post("api/bridge/events", body: body)
        } catch {
            fputs("FocusDockBridge: activity failed (\(error))\n", stderr)
        }
    }

    public func disconnect() async {
        do {
            _ = try await post("api/bridge/disconnect", body: [:])
        } catch {
            fputs("FocusDockBridge: disconnect failed (\(error))\n", stderr)
        }
    }

    /// Best-effort synchronous disconnect used during application termination.
    public func disconnectSync(timeout: TimeInterval = 1.0) {
        let url = backend.appendingPathComponent("api/bridge/disconnect")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.httpBody = Data("{}".utf8)
        request.timeoutInterval = timeout

        let semaphore = DispatchSemaphore(value: 0)
        let task = session.dataTask(with: request) { _, _, _ in semaphore.signal() }
        task.resume()
        _ = semaphore.wait(timeout: .now() + timeout)
    }
}
