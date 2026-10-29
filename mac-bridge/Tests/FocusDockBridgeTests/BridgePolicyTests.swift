import XCTest
@testable import FocusDockBridgeCore

final class BridgePolicyTests: XCTestCase {
    func testAcceptsLoopbackBackends() throws {
        for value in [
            "http://127.0.0.1:4317",
            "http://localhost:4317",
            "http://[::1]:4317",
        ] {
            let url = try XCTUnwrap(URL(string: value))
            XCTAssertTrue(BridgePolicy.isAllowedBackend(url), "expected \(value) to be allowed")
        }
    }

    func testRejectsRemoteOrInsecureBackends() throws {
        for value in [
            "https://127.0.0.1:4317",
            "http://evil.example:4317",
            "http://10.0.0.5:4317",
            "file:///tmp/dock",
        ] {
            let url = try XCTUnwrap(URL(string: value))
            XCTAssertFalse(BridgePolicy.isAllowedBackend(url), "expected \(value) to be rejected")
        }
    }

    func testNavigationIsLimitedToTheDockShell() throws {
        let backend = try XCTUnwrap(URL(string: "http://127.0.0.1:4317"))
        XCTAssertTrue(
            BridgePolicy.isAllowedNavigation(
                try XCTUnwrap(URL(string: "http://127.0.0.1:4317/dock")),
                backend: backend
            )
        )
        XCTAssertTrue(
            BridgePolicy.isAllowedNavigation(
                try XCTUnwrap(URL(string: "http://127.0.0.1:4317/assets/index.js")),
                backend: backend
            )
        )
        XCTAssertFalse(
            BridgePolicy.isAllowedNavigation(
                try XCTUnwrap(URL(string: "https://example.com/dock")),
                backend: backend
            )
        )
        XCTAssertFalse(
            BridgePolicy.isAllowedNavigation(
                try XCTUnwrap(URL(string: "http://127.0.0.1:4317/api/state")),
                backend: backend
            )
        )
    }

    func testConfigRejectsExternalBackend() {
        XCTAssertThrowsError(try BridgeConfig.parse(arguments: ["--backend", "http://evil.example:4317"]))
    }

    func testConfigDefaultsToTheLocalBackend() throws {
        let config = try BridgeConfig.parse(arguments: [])
        XCTAssertEqual(config.backend.port, 4317)
        XCTAssertTrue(config.tokenPath.contains("FocusDock"))
        XCTAssertFalse(config.withWindowTitles)
    }

    func testConfigReadsTitlesOnlyOnRequest() throws {
        let config = try BridgeConfig.parse(arguments: ["--with-titles"])
        XCTAssertTrue(config.withWindowTitles)
    }

    func testDefaultTokenPathIsUnderApplicationSupport() {
        XCTAssertTrue(BridgeConfig.defaultTokenPath().contains("Application Support"))
    }
}
