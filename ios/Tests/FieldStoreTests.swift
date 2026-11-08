import XCTest
@testable import ContractorSight

final class FieldStoreTests: XCTestCase {
    @MainActor func testDraftSurvivesRelaunch() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FieldStore(directory: directory)
        try store.save(note: "  Replace damaged trim  ", photo: Data([1, 2, 3]))
        let restored = FieldStore(directory: directory)
        XCTAssertNil(restored.loadError)
        XCTAssertEqual(restored.entries.count, 1)
        XCTAssertEqual(restored.entries[0].note, "Replace damaged trim")
        XCTAssertEqual(try Data(contentsOf: XCTUnwrap(restored.photoURL(for: restored.entries[0]))), Data([1, 2, 3]))
    }

    @MainActor func testCorruptIndexIsNotOverwritten() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let index = directory.appendingPathComponent("entries.json")
        let original = Data("broken".utf8)
        try original.write(to: index)
        let store = FieldStore(directory: directory)
        XCTAssertNotNil(store.loadError)
        XCTAssertThrowsError(try store.save(note: "new", photo: nil))
        XCTAssertEqual(try Data(contentsOf: index), original)
    }

    @MainActor func testEmptyDraftRejected() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FieldStore(directory: directory)
        XCTAssertThrowsError(try store.save(note: "  ", photo: nil))
        XCTAssertTrue(store.entries.isEmpty)
    }
}
