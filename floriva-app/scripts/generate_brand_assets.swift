#!/usr/bin/env swift

import Foundation

let scriptURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
let scriptsDirectory = scriptURL.deletingLastPathComponent()
let rootDirectory = scriptsDirectory.deletingLastPathComponent()
let bundledPython = rootDirectory.appendingPathComponent(".asset-venv/bin/python").path

let process = Process()
process.executableURL = URL(fileURLWithPath: FileManager.default.isExecutableFile(atPath: bundledPython) ? bundledPython : "/usr/bin/python3")
process.arguments = [scriptsDirectory.appendingPathComponent("generate_brand_assets.py").path] + Array(CommandLine.arguments.dropFirst())
process.standardOutput = FileHandle.standardOutput
process.standardError = FileHandle.standardError

try process.run()
process.waitUntilExit()
exit(process.terminationStatus)
