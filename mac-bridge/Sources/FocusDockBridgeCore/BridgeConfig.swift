import Darwin
import Foundation

public enum BridgeConfigError: Error, CustomStringConvertible {
    case badArgument(String)
    case unsafeBackend(String)
    case missingToken(String)
    case emptyToken

    public var description: String {
        switch self {
        case .badArgument(let message): return "bad argument: \(message)"
        case .unsafeBackend(let value): return "backend must be a loopback http URL, got \(value)"
        case .missingToken(let path): return "bridge token not found at \(path)"
        case .emptyToken: return "bridge token file is empty"
        }
    }
}

public struct BridgeConfig {
    public let backend: URL
    public let tokenPath: String
    public let withWindowTitles: Bool

    public init(backend: URL, tokenPath: String, withWindowTitles: Bool) {
        self.backend = backend
        self.tokenPath = tokenPath
        self.withWindowTitles = withWindowTitles
    }

    public static func parse(arguments: [String]) throws -> BridgeConfig {
        var backendString = "http://127.0.0.1:4317"
        var tokenPath = defaultTokenPath()
        var withWindowTitles = false
        var index = 0

        while index < arguments.count {
            switch arguments[index] {
            case "--backend":
                guard index + 1 < arguments.count else {
                    throw BridgeConfigError.badArgument("--backend needs a value")
                }
                backendString = arguments[index + 1]
                index += 2
            case "--token-path":
                guard index + 1 < arguments.count else {
                    throw BridgeConfigError.badArgument("--token-path needs a value")
                }
                tokenPath = arguments[index + 1]
                index += 2
            case "--with-titles":
                withWindowTitles = true
                index += 1
            case "--help", "-h":
                print(Self.usage)
                exit(0)
            default:
                index += 1
            }
        }

        guard let backend = URL(string: backendString), BridgePolicy.isAllowedBackend(backend) else {
            throw BridgeConfigError.unsafeBackend(backendString)
        }

        return BridgeConfig(
            backend: backend,
            tokenPath: tokenPath,
            withWindowTitles: withWindowTitles
        )
    }

    public static func defaultTokenPath() -> String {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        let base = support ?? URL(fileURLWithPath: NSHomeDirectory())
        return base
            .appendingPathComponent("FocusDock", isDirectory: true)
            .appendingPathComponent("runtime", isDirectory: true)
            .appendingPathComponent("bridge-token")
            .path
    }

    public static let usage = """
    FocusDock Bridge — optional macOS floating dock for FocusDock AI.

    Usage:
      FocusDockBridge [--backend http://127.0.0.1:4317]
                      [--token-path /path/to/bridge-token]
                      [--with-titles]

    --with-titles asks for Accessibility permission to read the frontmost
    window title. Without it, only bundle ids and app names are reported.
    The bridge only talks to loopback and never modifies the system Dock.
    """

    public func readToken() throws -> String {
        guard FileManager.default.fileExists(atPath: tokenPath) else {
            throw BridgeConfigError.missingToken(tokenPath)
        }
        let raw = try String(contentsOfFile: tokenPath, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { throw BridgeConfigError.emptyToken }
        return raw
    }
}
