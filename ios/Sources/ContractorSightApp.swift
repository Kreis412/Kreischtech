import SwiftUI
import PhotosUI
import UIKit

@main struct ContractorSightApp: App {
    var body: some Scene {
        WindowGroup { FieldHome().tint(.teal).preferredColorScheme(.dark) }
    }
}

struct FieldHome: View {
    @StateObject private var store = FieldStore()
    @StateObject private var client = WorkspaceClient()
    @State private var note = ""
    @State private var photo: Data?
    @State private var selection: PhotosPickerItem?
    @State private var camera = false
    @State private var loading = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Capture the job. Keep the details.").font(.title2.bold())
                    Text("iPhone preview • Save drafts offline. Sign in to upload photos and request analysis.")
                        .font(.subheadline).foregroundStyle(.secondary)
                    WorkspacePanel(client: client)
                    Button { camera = true } label: {
                        Label("Take a photo", systemImage: "camera.fill").frame(maxWidth: .infinity).padding(10)
                    }.buttonStyle(.borderedProminent)
                        .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera) || loading)
                    PhotosPicker(selection: $selection, matching: .images) {
                        Label("Choose a photo", systemImage: "photo.on.rectangle")
                    }.disabled(loading)
                    if loading { ProgressView("Opening photo…") }
                    if let photo, let image = UIImage(data: photo) {
                        Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 260).clipShape(RoundedRectangle(cornerRadius: 12))
                        Button("Remove selected photo", role: .destructive) { self.photo = nil; selection = nil }
                    }
                    Text("What did you discover?").font(.headline)
                    TextEditor(text: $note).frame(minHeight: 120).accessibilityLabel("Field note")
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.secondary))
                    Button("Save on this iPhone") {
                        do {
                            try store.save(note: note, photo: photo)
                            note = ""; photo = nil; selection = nil
                            message = "Saved on this device. No internet needed."
                        } catch { message = error.localizedDescription }
                    }.buttonStyle(.borderedProminent).disabled(loading || store.loadError != nil || (note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && photo == nil))
                    if let error = store.loadError { Text(error).foregroundStyle(.orange) }
                    Divider()
                    Text("Saved drafts").font(.headline)
                    if store.entries.isEmpty { Text("Your photos and notes will appear here.").foregroundStyle(.secondary) }
                    ForEach(store.entries.filter { $0.ownerEmail == nil || ($0.ownerEmail == client.account?.user?.email && $0.companyID == client.account?.company?.id) }) { entry in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(entry.createdAt, style: .date).font(.caption).foregroundStyle(.secondary)
                            Text(entry.note.isEmpty ? "Photo draft" : entry.note)
                            if let url = store.photoURL(for: entry) {
                                ShareLink(item: url) { Label("Share saved photo", systemImage: "square.and.arrow.up") }
                            }
                            if !entry.note.isEmpty { ShareLink("Share note", item: entry.note) }
                            if entry.uploadedPhotoID == nil { Text("On this device only").font(.caption).foregroundStyle(.secondary) }
                            DraftWorkspaceActions(entry: entry, store: store, client: client)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding().background(.thinMaterial).clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }.padding()
            }.navigationTitle("ContractorSight")
                .sheet(isPresented: $camera) {
                    CameraPicker { image in
                        camera = false
                        guard let image else { return }
                        if let data = normalizedPhoto(image) { photo = data }
                        else { message = "Could not prepare this photo. Please try another." }
                    }.ignoresSafeArea()
                }
                .onChange(of: selection) { _, item in
                    guard let item else { return }
                    loading = true
                    Task { @MainActor in
                        defer { loading = false }
                        do {
                            guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data), let jpeg = normalizedPhoto(image) else {
                                message = "Could not open that photo. Please choose another."; return
                            }
                            photo = jpeg
                        } catch { message = "Could not download that photo. An iCloud photo may need an internet connection." }
                    }
                }
                .alert("ContractorSight", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
                    Button("OK") { message = nil }
                } message: { Text(message ?? "") }
        }
    }
}

// Re-render to normalize orientation and omit original photo metadata.
func normalizedPhoto(_ image: UIImage) -> Data? {
    guard image.size.width > 0, image.size.height > 0 else { return nil }
    let scale = min(1, 2048 / max(image.size.width, image.size.height))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
        image.draw(in: CGRect(origin: .zero, size: size))
    }.jpegData(compressionQuality: 0.85)
}

struct CameraPicker: UIViewControllerRepresentable {
    let completion: (UIImage?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(completion) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController(); picker.sourceType = .camera; picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let completion: (UIImage?) -> Void
        init(_ completion: @escaping (UIImage?) -> Void) { self.completion = completion }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { completion(nil) }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            completion(info[.originalImage] as? UIImage)
        }
    }
}
