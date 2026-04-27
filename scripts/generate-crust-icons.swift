import AppKit
import CoreGraphics
import Foundation

let repoRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let outputDir = repoRoot
  .appendingPathComponent("apps")
  .appendingPathComponent("extension")
  .appendingPathComponent("public")
  .appendingPathComponent("icon")

try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

let sizes = [16, 24, 32, 48, 96, 128]
let variants: [(suffix: String, color: CGColor)] = [
  ("", CGColor(red: 0.235, green: 0.251, blue: 0.263, alpha: 1.0)),
  ("-light", CGColor(red: 0.741, green: 0.765, blue: 0.780, alpha: 1.0)),
]

func crustLogoPath() -> CGPath {
  let path = CGMutablePath()
  // Source: logo.svg, viewBox 0 0 24 24.
  path.move(to: CGPoint(x: 13.4, y: 2.75))
  path.addLine(to: CGPoint(x: 5.9, y: 13.05))
  path.addCurve(
    to: CGPoint(x: 6.69, y: 14.61),
    control1: CGPoint(x: 5.43, y: 13.7),
    control2: CGPoint(x: 5.89, y: 14.61),
  )
  path.addLine(to: CGPoint(x: 11.06, y: 14.61))
  path.addLine(to: CGPoint(x: 9.8, y: 21.25))
  path.addLine(to: CGPoint(x: 18.1, y: 10.62))
  path.addCurve(
    to: CGPoint(x: 17.32, y: 9.02),
    control1: CGPoint(x: 18.61, y: 9.97),
    control2: CGPoint(x: 18.15, y: 9.02),
  )
  path.addLine(to: CGPoint(x: 12.94, y: 9.02))
  path.addLine(to: CGPoint(x: 13.4, y: 2.75))
  path.closeSubpath()
  return path
}

func writeIcon(size: Int, suffix: String, color: CGColor) throws {
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  guard
    let context = CGContext(
      data: nil,
      width: size,
      height: size,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )
  else {
    throw NSError(domain: "CrustIcon", code: 1)
  }

  context.clear(CGRect(x: 0, y: 0, width: size, height: size))
  context.setShouldAntialias(true)
  context.translateBy(x: 0, y: CGFloat(size))
  context.scaleBy(x: CGFloat(size) / 24.0, y: -CGFloat(size) / 24.0)
  context.translateBy(x: 12, y: 12)
  context.scaleBy(x: 1.22, y: 1.22)
  context.translateBy(x: -12, y: -12)
  context.addPath(crustLogoPath())
  context.setStrokeColor(color)
  context.setLineWidth(1.55)
  context.setLineJoin(.round)
  context.setLineCap(.round)
  context.strokePath()

  guard let image = context.makeImage() else {
    throw NSError(domain: "CrustIcon", code: 2)
  }
  let bitmap = NSBitmapImageRep(cgImage: image)
  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "CrustIcon", code: 3)
  }
  let url = outputDir.appendingPathComponent("\(size)\(suffix).png")
  try data.write(to: url)
}

for size in sizes {
  for variant in variants {
    try writeIcon(size: size, suffix: variant.suffix, color: variant.color)
  }
}
