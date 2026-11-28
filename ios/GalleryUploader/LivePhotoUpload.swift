import AVFoundation
import CryptoKit
import ImageIO
import PhotosUI
import UIKit

enum UploadError: LocalizedError {
    case livePhotoUnavailable
    case invalidPhoto
    case tooLarge
    case invalidResponse
    case unauthorized
    case server(String)

    var errorDescription: String? {
        switch self {
        case .livePhotoUnavailable: "无法读取这张实况照片的封面或视频。"
        case .invalidPhoto: "无法生成实况照片的网页封面。"
        case .tooLarge: "实况照片处理后仍超过上传大小限制。"
        case .unauthorized: "这台 iPhone 尚未授权或授权已撤销，请在 CMS 重新授权。"
        case .invalidResponse: "网站返回了无法识别的上传结果。"
        case .server(let message): message
        }
    }
}

struct LivePhotoUpload {
    private let importID: String
    private let sourceFilename: String
    private let date: String?
    private let image: Data
    private let video: Data

    static func prepare(_ provider: NSItemProvider) async throws -> LivePhotoUpload {
        let livePhoto: PHLivePhoto = try await withCheckedThrowingContinuation { continuation in
            provider.loadObject(ofClass: PHLivePhoto.self) { object, error in
                if let photo = object as? PHLivePhoto {
                    continuation.resume(returning: photo)
                } else {
                    continuation.resume(throwing: error ?? UploadError.livePhotoUnavailable)
                }
            }
        }

        let resources = PHAssetResource.assetResources(for: livePhoto)
        guard let imageResource = resources.first(where: { $0.type == .fullSizePhoto })
                ?? resources.first(where: { $0.type == .photo }),
              let videoResource = resources.first(where: { $0.type == .fullSizePairedVideo })
                ?? resources.first(where: { $0.type == .pairedVideo }) else {
            throw UploadError.livePhotoUnavailable
        }

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let imageURL = directory.appendingPathComponent("original-image")
        let videoURL = directory.appendingPathComponent("original.mov")
        try await write(imageResource, to: imageURL)
        try await write(videoResource, to: videoURL)

        let imageHash = SHA256.hash(data: try Data(contentsOf: imageURL, options: .mappedIfSafe))
        let videoHash = SHA256.hash(data: try Data(contentsOf: videoURL, options: .mappedIfSafe))
        var hasher = SHA256()
        hasher.update(data: Data(imageHash))
        hasher.update(data: Data(videoHash))
        let importID = hasher.finalize().map { String(format: "%02x", $0) }.joined()

        let cover = try makeCover(from: imageURL)
        let video = try await makeVideo(from: videoURL, in: directory, budget: 4_250_000 - cover.data.count)
        return LivePhotoUpload(importID: importID, sourceFilename: imageResource.originalFilename,
                               date: cover.date, image: cover.data, video: video)
    }

    private static func write(_ resource: PHAssetResource, to url: URL) async throws {
        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHAssetResourceManager.default().writeData(for: resource, toFile: url, options: options) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    private static func makeCover(from url: URL) throws -> (data: Data, date: String?) {
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2560,
        ] as [CFString: Any]
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            throw UploadError.invalidPhoto
        }
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any]
        let exif = properties?[kCGImagePropertyExifDictionary as String] as? [String: Any]
        let dateTime = exif?[kCGImagePropertyExifDateTimeOriginal as String] as? String
        let date = dateTime.map { String($0.prefix(10)).replacingOccurrences(of: ":", with: "-") }

        let cover = UIImage(cgImage: image)
        let qualities: [CGFloat] = [0.88, 0.76, 0.60]
        for quality in qualities {
            if let data = cover.jpegData(compressionQuality: quality), data.count <= 1_500_000 {
                return (data, date)
            }
        }
        throw UploadError.invalidPhoto
    }

    private static func makeVideo(from url: URL, in directory: URL, budget: Int) async throws -> Data {
        let asset = AVURLAsset(url: url)
        let presets = [AVAssetExportPreset1920x1080, AVAssetExportPreset1280x720,
                       AVAssetExportPreset960x540, AVAssetExportPreset640x480]
        var exportError: Error?
        for preset in presets {
            guard let export = AVAssetExportSession(asset: asset, presetName: preset),
                  export.supportedFileTypes.contains(.mp4) else { continue }
            let output = directory.appendingPathComponent("\(preset).mp4")
            export.metadata = []
            export.shouldOptimizeForNetworkUse = true
            do {
                try await export.export(to: output, as: .mp4)
            } catch {
                exportError = error
                continue
            }
            let size = try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            if size > 0 && size <= budget { return try Data(contentsOf: output) }
            try? FileManager.default.removeItem(at: output)
        }
        throw exportError ?? UploadError.tooLarge
    }

    func publish(to endpoint: URL, key: String) async throws -> URL {
        let boundary = "Gallery-\(UUID().uuidString)"
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        func file(_ name: String, filename: String, contentType: String, data: Data) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(contentType)\r\n\r\n".utf8))
            body.append(data)
            body.append(Data("\r\n".utf8))
        }
        field("importId", importID)
        field("sourceFilename", sourceFilename)
        if let date { field("date", date) }
        file("image", filename: "cover.jpg", contentType: "image/jpeg", data: image)
        file("video", filename: "live.mp4", contentType: "video/mp4", data: video)
        body.append(Data("--\(boundary)--\r\n".utf8))

        var request = URLRequest(url: endpoint, timeoutInterval: 120)
        request.httpMethod = "POST"
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.upload(for: request, from: body, delegate: NoRedirects())
        guard let http = response as? HTTPURLResponse else { throw UploadError.invalidResponse }
        if http.statusCode == 401 { throw UploadError.unauthorized }
        let reply = try? JSONDecoder().decode(UploadReply.self, from: data)
        guard (200..<300).contains(http.statusCode) else {
            throw UploadError.server(reply?.error ?? "上传失败（HTTP \(http.statusCode)）。")
        }
        guard let path = reply?.path, path.hasPrefix("/photos/"),
              let url = URL(string: path, relativeTo: endpoint)?.absoluteURL else {
            throw UploadError.invalidResponse
        }
        return url
    }
}

private struct UploadReply: Decodable {
    let path: String?
    let error: String?
}

final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
