import SwiftUI

struct WorkspacePanel: View {
    @ObservedObject var client: WorkspaceClient
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let account = client.account, let company = account.company {
                Text(company.name).font(.headline)
                Text(account.user?.email ?? "").font(.caption)
                Text("\(client.projects.count) projects • \(company.role)").font(.subheadline)
                Button("Sign out") { Task { await client.signOut() } }.disabled(client.busy)
            } else {
                Text("Connect your existing account").font(.headline)
                TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField("Password", text: $password).textContentType(.password)
                Button("Sign in") {
                    Task {
                        error = nil
                        do { try await client.signIn(email: email, password: password) }
                        catch { self.error = error.localizedDescription }
                        password = ""
                    }
                }.buttonStyle(.borderedProminent).disabled(client.busy || email.isEmpty || password.isEmpty)
                Text("For this preview, sign in again after closing the app. Your password is not saved.").font(.caption).foregroundStyle(.secondary)
            }
            if client.busy { ProgressView("Connecting…") }
            if let error { Text(error).foregroundStyle(.orange) }
        }.padding().background(.thinMaterial).clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct DraftWorkspaceActions: View {
    let entry: FieldEntry
    @ObservedObject var store: FieldStore
    @ObservedObject var client: WorkspaceClient
    @State private var selectedProject = ""
    @State private var consent = false
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let account = client.account, let owner = account.user?.email, let company = account.company {
                if entry.ownerEmail == nil || (entry.ownerEmail == owner && entry.companyID == company.id) {
                    if entry.photoName != nil && entry.uploadedPhotoID == nil {
                        if entry.projectID == nil {
                            Picker("Save photo to project", selection: $selectedProject) {
                                Text("Choose project").tag("")
                                ForEach(client.projects) { Text($0.name).tag($0.id) }
                            }.disabled(client.busy)
                        } else {
                            Text("Project: \(client.projects.first(where: { $0.id == entry.projectID })?.name ?? "Original project")").font(.caption)
                        }
                        Button(entry.projectID == nil ? "Upload photo to project" : "Retry photo upload") {
                            Task {
                                do {
                                    error = nil
                                    let bound = try store.bind(entry.id, owner: owner, company: company.id, project: entry.projectID ?? selectedProject)
                                    guard let url = store.photoURL(for: bound) else { return }
                                    let data = try Data(contentsOf: url)
                                    let photoID = try await client.upload(bound, data: data)
                                    try store.markUploaded(entry.id, photoID: photoID)
                                } catch { self.error = error.localizedDescription }
                            }
                        }.disabled(client.busy || company.role == "Viewer" || (entry.projectID == nil && selectedProject.isEmpty))
                    }
                    if entry.uploadedPhotoID != nil {
                        Text("Photo saved to your project. Local copy kept.").font(.caption)
                        if let summary = entry.analysisSummary {
                            Text("AI analysis").font(.headline)
                            Text(summary)
                        } else if ["Owner", "Manager"].contains(company.role) {
                            Toggle("Send this photo and note to OpenAI for analysis", isOn: $consent)
                            Text("Uses your existing analysis allowance. AI results need your review. Notes are sent as analysis context, not saved as a separate project note.").font(.caption).foregroundStyle(.secondary)
                            Button("Analyze photo") {
                                Task {
                                    do {
                                        error = nil
                                        let summary = try await client.analyze(entry)
                                        try store.saveAnalysis(entry.id, summary: summary)
                                    } catch { self.error = error.localizedDescription + " No automatic retry was made. Check the project for a saved result before trying again." }
                                }
                            }.buttonStyle(.borderedProminent).disabled(!consent || client.busy)
                        }
                    }
                }
            }
            if let error { Text(error).foregroundStyle(.orange) }
        }
    }
}
