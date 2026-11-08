import XCTest
@testable import ContractorSight

final class WorkspaceTests: XCTestCase {
    @MainActor func testRequestsUseExistingOriginWithoutWeakeningServerSecurity() throws {
        let body = Data("{}".utf8)
        let request = try WorkspaceClient.makeRequest(path: "/api/account/login", method: "POST", body: body)
        XCTAssertEqual(request.url?.scheme, "https")
        XCTAssertEqual(request.url?.host, "contractorsight-pilot.onrender.com")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), WorkspaceClient.origin)
        XCTAssertEqual(request.httpBody, body)
        XCTAssertThrowsError(try WorkspaceClient.makeRequest(path: "https://example.com/api/account/login"))
    }

    @MainActor func testDraftCannotMoveBetweenAccountsOrProjectsAfterBinding() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FieldStore(directory: directory)
        try store.save(note: "Check trim", photo: Data([1]))
        let id = try XCTUnwrap(store.entries.first?.id)
        let company = UUID().uuidString, project = UUID().uuidString
        let bound = try store.bind(id, owner: "owner@example.com", company: company, project: project)
        XCTAssertEqual(bound.projectID, project)
        XCTAssertThrowsError(try store.bind(id, owner: "different@example.com", company: company, project: project))
        XCTAssertThrowsError(try store.bind(id, owner: "owner@example.com", company: UUID().uuidString, project: project))
        XCTAssertThrowsError(try store.bind(id, owner: "owner@example.com", company: company, project: UUID().uuidString))
        try store.markUploaded(id, photoID: "server-photo")
        try store.saveAnalysis(id, summary: "Review the trim.")
        let restored = FieldStore(directory: directory)
        XCTAssertEqual(restored.entries.first?.ownerEmail, "owner@example.com")
        XCTAssertEqual(restored.entries.first?.uploadedPhotoID, "server-photo")
        XCTAssertEqual(restored.entries.first?.analysisSummary, "Review the trim.")
        XCTAssertEqual(restored.entries.first?.id, id)
    }

    func testOldLocalDraftsRemainReadable() throws {
        let id = UUID()
        let data = try JSONSerialization.data(withJSONObject: ["id": id.uuidString, "createdAt": 0, "note": "Original offline note"])
        let draft = try JSONDecoder().decode(FieldEntry.self, from: data)
        XCTAssertEqual(draft.note, "Original offline note")
        XCTAssertNil(draft.ownerEmail)
        XCTAssertNil(draft.uploadedPhotoID)
    }

    func testExistingBackendResponseShapes() throws {
        let data = Data(#"{"user":{"name":"Test","email":"test@example.com"},"company":{"id":"company","name":"Business","role":"Owner"},"companies":[]}"#.utf8)
        let session = try JSONDecoder().decode(WorkspaceSession.self, from: data)
        XCTAssertEqual(session.company?.role, "Owner")
        let projects = try JSONDecoder().decode([WorkspaceProject].self, from: Data(#"[{"id":"project","name":"Walkway","photo_count":1}]"#.utf8))
        XCTAssertEqual(projects.first?.name, "Walkway")
        let reply = try JSONDecoder().decode(AnalysisReply.self, from: Data(#"{"id":"analysis","summary":"Check the trim","reused":true}"#.utf8))
        XCTAssertEqual(reply.summary, "Check the trim")
    }
}
