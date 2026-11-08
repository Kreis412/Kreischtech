import Foundation
import Combine

struct FieldEntry: Codable, Identifiable {
    let id: UUID
    let createdAt: Date
    let note: String
    let photoName: String?
    var ownerEmail: String? = nil
    var companyID: String? = nil
    var projectID: String? = nil
    var uploadedPhotoID: String? = nil
    var analysisSummary: String? = nil
}

/// Local drafts only. Never mark a draft uploaded until the server acknowledges it.
@MainActor final class FieldStore: ObservableObject {
    @Published private(set) var entries: [FieldEntry] = []
    @Published private(set) var loadError: String?
    private let directory: URL
    private let manager = FileManager.default
    private var index: URL { directory.appendingPathComponent("entries.json") }

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("FieldDrafts", isDirectory: true)
        do {
            try manager.createDirectory(at: self.directory, withIntermediateDirectories: true)
            if manager.fileExists(atPath: index.path) {
                entries = try JSONDecoder().decode([FieldEntry].self, from: Data(contentsOf: index))
            }
        } catch {
            loadError = "Saved drafts could not be opened. Existing files have been kept."
        }
    }

    func save(note: String, photo: Data?) throws {
        guard loadError == nil else { throw StoreError.unavailable }
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || photo != nil else { throw StoreError.empty }
        let id = UUID()
        let photoName = photo == nil ? nil : "\(id.uuidString).jpg"
        let photoURL = photoName.map { directory.appendingPathComponent($0) }
        if let photo, let photoURL {
            try photo.write(to: photoURL, options: [.atomic, .completeFileProtection])
        }
        let entry = FieldEntry(id: id, createdAt: Date(), note: text, photoName: photoName)
        let updated = [entry] + entries
        do {
            try JSONEncoder().encode(updated).write(to: index, options: [.atomic, .completeFileProtection])
            entries = updated
        } catch {
            if let photoURL { try? manager.removeItem(at: photoURL) }
            throw error
        }
    }

    func photoURL(for entry: FieldEntry) -> URL? {
        guard let name = entry.photoName, name == "\(entry.id.uuidString).jpg" else { return nil }
        return directory.appendingPathComponent(name)
    }

    func bind(_ id: UUID, owner: String, company: String, project: String) throws -> FieldEntry {
        guard !owner.isEmpty, UUID(uuidString: company) != nil, UUID(uuidString: project) != nil,
              let entry = entries.first(where: { $0.id == id }),
              entry.ownerEmail == nil || (entry.ownerEmail == owner && entry.companyID == company && entry.projectID == project) else { throw StoreError.unavailable }
        return try update(id) { $0.ownerEmail = owner; $0.companyID = company; $0.projectID = project }
    }

    @discardableResult func markUploaded(_ id: UUID, photoID: String) throws -> FieldEntry {
        try update(id) { $0.uploadedPhotoID = photoID }
    }

    @discardableResult func saveAnalysis(_ id: UUID, summary: String) throws -> FieldEntry {
        try update(id) { $0.analysisSummary = summary }
    }

    private func update(_ id: UUID, change: (inout FieldEntry) -> Void) throws -> FieldEntry {
        guard loadError == nil, let position = entries.firstIndex(where: { $0.id == id }) else { throw StoreError.unavailable }
        var updated = entries
        change(&updated[position])
        try JSONEncoder().encode(updated).write(to: index, options: [.atomic, .completeFileProtection])
        entries = updated
        return updated[position]
    }

    enum StoreError: LocalizedError {
        case unavailable, empty
        var errorDescription: String? {
            switch self {
            case .unavailable: return "Draft storage is unavailable. Your existing files have not been changed."
            case .empty: return "Add a photo or note first."
            }
        }
    }
}
