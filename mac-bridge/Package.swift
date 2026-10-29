// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FocusDockBridge",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "FocusDockBridge", targets: ["FocusDockBridge"]),
        .library(name: "FocusDockBridgeCore", targets: ["FocusDockBridgeCore"]),
    ],
    targets: [
        .target(
            name: "FocusDockBridgeCore",
            path: "Sources/FocusDockBridgeCore"
        ),
        .executableTarget(
            name: "FocusDockBridge",
            dependencies: ["FocusDockBridgeCore"],
            path: "Sources/FocusDockBridge"
        ),
        .testTarget(
            name: "FocusDockBridgeTests",
            dependencies: ["FocusDockBridgeCore"],
            path: "Tests/FocusDockBridgeTests"
        ),
    ]
)
