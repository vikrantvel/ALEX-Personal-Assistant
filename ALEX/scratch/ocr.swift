import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    print("Error: Missing image path argument.")
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let fileURL = URL(fileURLWithPath: imagePath)

guard let image = NSImage(contentsOf: fileURL) else {
    print("Error: Could not load image at path \(imagePath)")
    exit(1)
}

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let cgImage = bitmap.cgImage else {
    print("Error: Could not extract CGImage from NSImage.")
    exit(1)
}

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNRecognizeTextRequest { request, error in
    if let error = error {
        print("OCR Error: \(error.localizedDescription)")
        return
    }
    
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    let recognizedStrings = observations.compactMap { observation in
        observation.topCandidates(1).first?.string
    }
    print(recognizedStrings.joined(separator: "\n"))
}

request.recognitionLevel = .accurate

do {
    try requestHandler.perform([request])
} catch {
    print("Error performing OCR request: \(error.localizedDescription)")
}
