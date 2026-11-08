import Foundation
import Combine

struct WorkspaceSession: Decodable {
    struct User: Decodable { let name: String; let email: String }
    struct Company: Decodable { let id: String; let name: String; let role: String }
    let user: User?
    let company: Company?
}
struct WorkspaceProject: Decodable, Identifiable { let id: String; let name: String }
struct UploadedPhoto: Decodable { let id: String }
struct AnalysisReply: Decodable { let summary: String }
private struct SavedReply: Decodable { let saved: Bool }
private struct ServerFailure: Decodable { let error: String }

// Credentials must never follow a redirect to another host.
final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@MainActor final class WorkspaceClient: ObservableObject {
    static let origin = "https://contractorsight-pilot.onrender.com"
    @Published private(set) var account: WorkspaceSession?
    @Published private(set) var projects: [WorkspaceProject] = []
    @Published private(set) var busy = false
    private let transport: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 150
        config.urlCache = nil
        transport = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }

    static func makeRequest(path: String, method: String = "GET", body: Data? = nil, contentType: String = "application/json") throws -> URLRequest {
        guard path.hasPrefix("/api/"), let url = URL(string: origin + path), url.host == "contractorsight-pilot.onrender.com", url.scheme == "https" else { throw ClientError.message("Invalid workspace address.") }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest, as: T.Type) async throws -> T {
        let (data, response) = try await transport.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw ClientError.message("No workspace response. Your draft is still saved.") }
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 401 { account = nil; projects = [] }
            let message = (try? JSONDecoder().decode(ServerFailure.self, from: data).error) ?? "Workspace request failed (HTTP \(response.statusCode)). Your draft is still saved."
            throw ClientError.message(message)
        }
        guard response.value(forHTTPHeaderField: "Content-Type")?.contains("application/json") == true else { throw ClientError.message("Unexpected server response. Your draft is still saved.") }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func signIn(email: String, password: String) async throws {
        guard !busy else { return }
        busy = true; defer { busy = false }
        clearSession()
        let body = try JSONSerialization.data(withJSONObject: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines), "password": password])
        do {
            let _: SavedReply = try await send(Self.makeRequest(path: "/api/account/login", method: "POST", body: body), as: SavedReply.self)
            let session = try await send(Self.makeRequest(path: "/api/account/session"), as: WorkspaceSession.self)
            guard session.user != nil, session.company != nil else { throw ClientError.message("Please sign in again.") }
            account = session
            projects = try await send(Self.makeRequest(path: "/api/projects"), as: [WorkspaceProject].self)
        } catch { clearSession(); throw error }
    }

    func signOut() async {
        guard !busy else { return }
        busy = true; defer { busy = false; clearSession() }
        let _: SavedReply? = try? await send(Self.makeRequest(path: "/api/account/logout", method: "POST", body: Data("{}".utf8)), as: SavedReply.self)
    }

    private func clearSession() {
        account = nil; projects = []
        if let storage = transport.configuration.httpCookieStorage {
            for cookie in storage.cookies ?? [] { storage.deleteCookie(cookie) }
        }
    }

    private func verifyOwner(_ entry: FieldEntry) async throws {
        let session = try await send(Self.makeRequest(path: "/api/account/session"), as: WorkspaceSession.self)
        guard let owner = entry.ownerEmail, let company = entry.companyID,
              session.user?.email == owner, session.company?.id == company else {
            throw ClientError.message("Sign in to the original account and business for this draft.")
        }
    }

    func upload(_ entry: FieldEntry, data: Data) async throws -> String {
        guard !busy else { throw ClientError.message("Wait for the current request to finish.") }
        busy = true; defer { busy = false }
        try await verifyOwner(entry)
        guard let project = entry.projectID, UUID(uuidString: project) != nil else { throw ClientError.message("Choose a project first.") }
        var request = try Self.makeRequest(path: "/api/projects/\(project)/photos?name=iphone-\(entry.id.uuidString).jpg", method: "POST", body: data, contentType: "image/jpeg")
        request.setValue(entry.id.uuidString, forHTTPHeaderField: "X-Upload-Id")
        request.setValue(entry.companyID, forHTTPHeaderField: "X-Upload-Company")
        let owner = entry.ownerEmail?.addingPercentEncoding(withAllowedCharacters: CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"))
        request.setValue(owner, forHTTPHeaderField: "X-Upload-Owner")
        let result = try await send(request, as: UploadedPhoto.self)
        return result.id
    }

    // No automatic retry: a timeout does not prove the AI request failed.
    func analyze(_ entry: FieldEntry) async throws -> String {
        guard !busy else { throw ClientError.message("Wait for the current request to finish.") }
        busy = true; defer { busy = false }
        try await verifyOwner(entry)
        guard let project = entry.projectID, UUID(uuidString: project) != nil, let photo = entry.uploadedPhotoID else { throw ClientError.message("Upload this photo first.") }
        guard entry.note.count <= 2000 else { throw ClientError.message("Shorten the analysis note to 2,000 characters or fewer.") }
        let body = try JSONSerialization.data(withJSONObject: ["photo_id": photo, "provider": "openai", "cloud_consent": true, "context": entry.note, "detail": "concise", "refresh": false])
        let reply = try await send(Self.makeRequest(path: "/api/projects/\(project)/analysis", method: "POST", body: body), as: AnalysisReply.self)
        return reply.summary
    }

    enum ClientError: LocalizedError {
        case message(String)
        var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
    }
}
