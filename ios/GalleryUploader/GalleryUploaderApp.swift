import CryptoKit
import PhotosUI
import SwiftUI

@main
struct GalleryUploaderApp: App {
    var body: some Scene {
        WindowGroup { UploadView() }
    }
}

private struct UploadView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @State private var key = UploadKey.read() ?? ""
    @State private var authorized = false
    @State private var showingPicker = false
    @State private var retryPhoto: PHPickerResult?
    @State private var status: String?
    @State private var error: String?
    @State private var publishedURL: URL?
    private let site = URL(string: "https://www.queenstown.top")!

    private var fingerprint: String {
        SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if authorized {
                        Button { showingPicker = true } label: {
                            Label("选择并上传实况照片", systemImage: "livephoto")
                        }
                        .disabled(status != nil)
                    } else if !key.isEmpty {
                        LabeledContent("本机识别码", value: String(fingerprint.prefix(8)).uppercased())
                        Button("打开 CMS 授权这台 iPhone") {
                            openURL(site.appendingPathComponent("studio/iphone/\(fingerprint)"))
                        }
                        Button("检查授权状态") { Task { await checkAuthorization() } }
                    }
                    if let status { ProgressView(status) }
                    if let error {
                        Text(error).foregroundStyle(.red)
                        if let retryPhoto, authorized { Button("重试上传") { upload(retryPhoto) } }
                    }
                    if let publishedURL {
                        Label("已发布", systemImage: "checkmark.circle.fill")
                        Link("在网站查看实况照片", destination: publishedURL)
                    }
                } footer: {
                    Text(authorized ? "选中后会直接发布到网站。" : "首次使用请在 CMS 登录，核对识别码并点授权，然后返回 App。")
                }
            }
            .navigationTitle("Gallery 上传")
            .sheet(isPresented: $showingPicker) {
                LivePhotoPicker { result in
                    showingPicker = false
                    if let result { upload(result) }
                }
                .ignoresSafeArea()
            }
            .task(id: scenePhase) {
                guard scenePhase == .active else { return }
                if key.isEmpty {
                    guard let newKey = UploadKey.generate() else {
                        error = "无法保存本机授权信息，请解锁 iPhone 后重新打开 App。"
                        return
                    }
                    key = newKey
                }
                await checkAuthorization()
            }
        }
    }

    @MainActor private func checkAuthorization() async {
        var request = URLRequest(url: site.appendingPathComponent("api/iphone-device"))
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        do {
            let (_, response) = try await URLSession.shared.data(for: request, delegate: NoRedirects())
            try Task.checkCancellation()
            switch (response as? HTTPURLResponse)?.statusCode {
            case 200: authorized = true
            case 401: authorized = false
            default: throw UploadError.server("暂时无法检查 CMS 授权，请稍后重试。")
            }
            if retryPhoto == nil { error = nil }
        } catch {
            if !Task.isCancelled { self.error = error.localizedDescription }
        }
    }

    private func upload(_ photo: PHPickerResult) {
        guard status == nil else { return }
        publishedURL = nil
        error = nil
        retryPhoto = photo
        status = "正在读取并处理实况照片…"
        Task { @MainActor in
            defer { status = nil }
            do {
                let prepared = try await LivePhotoUpload.prepare(photo.itemProvider)
                status = "正在上传到 Gallery…"
                publishedURL = try await prepared.publish(to: site.appendingPathComponent("api/live-photo"), key: key)
                retryPhoto = nil
            } catch UploadError.unauthorized {
                authorized = false
                self.error = UploadError.unauthorized.localizedDescription
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
private struct LivePhotoPicker: UIViewControllerRepresentable {
    let onSelect: (PHPickerResult?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onSelect: onSelect) }

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration()
        configuration.filter = .livePhotos
        configuration.preferredAssetRepresentationMode = .current
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: PHPickerViewController, context: Context) {}

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        private let onSelect: (PHPickerResult?) -> Void

        init(onSelect: @escaping (PHPickerResult?) -> Void) {
            self.onSelect = onSelect
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            onSelect(results.first)
        }
    }
}
