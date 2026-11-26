import PhotosUI
import SwiftUI

@main
struct GalleryUploaderApp: App {
    var body: some Scene {
        WindowGroup { UploadView() }
    }
}

private struct UploadView: View {
    @AppStorage("uploadEndpoint") private var endpoint = "https://www.queenstown.top/api/live-photo"
    @State private var key = UploadKey.read() ?? ""
    @State private var showingSettings = false
    @State private var showingPicker = false
    @State private var retryPhoto: PHPickerResult?
    @State private var status: String?
    @State private var error: String?
    @State private var publishedURL: URL?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button {
                        if key.isEmpty { showingSettings = true } else { showingPicker = true }
                    } label: {
                        Label("选择并上传实况照片", systemImage: "livephoto")
                    }
                    .disabled(status != nil)

                    if let status { ProgressView(status) }

                    if let error {
                        Text(error).foregroundStyle(.red)
                        if let retryPhoto {
                            Button("重试上传") { upload(retryPhoto) }
                        }
                    }

                    if let publishedURL {
                        Label("已发布", systemImage: "checkmark.circle.fill")
                        Link("在网站查看实况照片", destination: publishedURL)
                    }
                } footer: {
                    Text(key.isEmpty ? "首次使用时输入网站的上传密钥。" : "选中后会直接发布到网站。")
                }
            }
            .navigationTitle("Gallery 上传")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("设置", systemImage: "gearshape") { showingSettings = true }
                        .labelStyle(.iconOnly)
                        .disabled(status != nil)
                }
            }
            .sheet(isPresented: $showingSettings) {
                ConnectionSettings(endpoint: endpoint, key: key) { newEndpoint, newKey in
                    endpoint = newEndpoint
                    key = newKey
                }
            }
            .sheet(isPresented: $showingPicker) {
                LivePhotoPicker { result in
                    showingPicker = false
                    if let result { upload(result) }
                }
                .ignoresSafeArea()
            }
        }
    }

    private func upload(_ photo: PHPickerResult) {
        guard status == nil, let uploadURL = URL(string: endpoint) else { return }
        publishedURL = nil
        error = nil
        retryPhoto = photo
        status = "正在读取并处理实况照片…"
        Task { @MainActor in
            defer { status = nil }
            do {
                let prepared = try await LivePhotoUpload.prepare(photo.itemProvider)
                status = "正在上传到 Gallery…"
                publishedURL = try await prepared.publish(to: uploadURL, key: key)
                retryPhoto = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

private struct ConnectionSettings: View {
    @Environment(\.dismiss) private var dismiss
    @State var endpoint: String
    @State var key: String
    @State private var error: String?
    let onSave: (String, String) -> Void

    init(endpoint: String, key: String, onSave: @escaping (String, String) -> Void) {
        _endpoint = State(initialValue: endpoint)
        _key = State(initialValue: key)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Gallery 网站") {
                    TextField("HTTPS 上传地址", text: $endpoint)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section("上传密钥") {
                    SecureField("上传密钥", text: $key)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("保存", action: save) }
            }
        }
    }

    private func save() {
        let address = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        let secret = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URLComponents(string: address), url.scheme == "https", let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil, url.path == "/api/live-photo", url.fragment == nil else {
            error = "请输入以 /api/live-photo 结尾的 HTTPS 上传地址。"
            return
        }
        guard !secret.isEmpty else {
            error = "请输入上传密钥。"
            return
        }
        guard UploadKey.save(secret) else {
            error = "无法将上传密钥存入 iPhone 钥匙串。"
            return
        }
        onSave(address, secret)
        dismiss()
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
