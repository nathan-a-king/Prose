import SwiftUI
import UniformTypeIdentifiers

struct ProseDocument: Identifiable, Equatable {
    let id: UUID
    var title: String
    var content: String
    var fileURL: URL?
    var createdAt: Date
    var modifiedAt: Date
    var isPinned: Bool

    var hasUnsavedChanges: Bool = false

    init(
        id: UUID = UUID(),
        title: String = "Untitled",
        content: String = "",
        fileURL: URL? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        isPinned: Bool = false
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.fileURL = fileURL
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.isPinned = isPinned
    }

    static func == (lhs: ProseDocument, rhs: ProseDocument) -> Bool {
        lhs.id == rhs.id
    }
}

@MainActor
class DocumentManager: ObservableObject {
    @Published var documents: [ProseDocument] = []
    @Published var currentDocument: ProseDocument?
    @Published var isSidebarVisible: Bool = true

    private let recentDocumentsKey = "recentDocuments"

    init() {
        loadRecentDocuments()
        if documents.isEmpty {
            createNewDocument()
        } else {
            currentDocument = documents.first
        }
    }

    func createNewDocument() {
        let newDoc = ProseDocument(
            title: "Untitled",
            content: ""
        )
        documents.insert(newDoc, at: 0)
        currentDocument = newDoc
    }

    func openDocument() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText, UTType(filenameExtension: "md")!]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false

        if panel.runModal() == .OK, let url = panel.url {
            loadDocument(from: url)
        }
    }

    func loadDocument(from url: URL) {
        do {
            let content = try String(contentsOf: url, encoding: .utf8)
            let title = url.deletingPathExtension().lastPathComponent

            // Check if document is already open
            if let existingIndex = documents.firstIndex(where: { $0.fileURL == url }) {
                currentDocument = documents[existingIndex]
                return
            }

            let doc = ProseDocument(
                title: title,
                content: content,
                fileURL: url,
                modifiedAt: Date()
            )

            documents.insert(doc, at: 0)
            currentDocument = doc
            saveRecentDocuments()
        } catch {
            print("Error loading document: \(error)")
        }
    }

    func saveCurrentDocument() {
        guard var doc = currentDocument else { return }

        if let fileURL = doc.fileURL {
            saveDocument(doc, to: fileURL)
        } else {
            saveDocumentAs()
        }
    }

    func saveDocumentAs() {
        guard var doc = currentDocument else { return }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "md")!]
        panel.nameFieldStringValue = doc.title.isEmpty ? "Untitled.md" : "\(doc.title).md"

        if panel.runModal() == .OK, let url = panel.url {
            doc.fileURL = url
            doc.title = url.deletingPathExtension().lastPathComponent
            saveDocument(doc, to: url)
        }
    }

    func saveDocument(_ document: ProseDocument, to url: URL) {
        do {
            try document.content.write(to: url, atomically: true, encoding: .utf8)

            if let index = documents.firstIndex(where: { $0.id == document.id }) {
                documents[index].fileURL = url
                documents[index].hasUnsavedChanges = false
                documents[index].modifiedAt = Date()

                if currentDocument?.id == document.id {
                    currentDocument = documents[index]
                }
            }

            saveRecentDocuments()
        } catch {
            print("Error saving document: \(error)")
        }
    }

    func updateContent(_ content: String) {
        guard var doc = currentDocument,
              let index = documents.firstIndex(where: { $0.id == doc.id }) else { return }

        documents[index].content = content
        documents[index].hasUnsavedChanges = true
        documents[index].modifiedAt = Date()
        currentDocument = documents[index]
    }

    func selectDocument(_ document: ProseDocument) {
        currentDocument = document
    }

    func deleteDocument(_ document: ProseDocument) {
        documents.removeAll { $0.id == document.id }
        if currentDocument?.id == document.id {
            currentDocument = documents.first
        }
        saveRecentDocuments()
    }

    func togglePin(_ document: ProseDocument) {
        if let index = documents.firstIndex(where: { $0.id == document.id }) {
            documents[index].isPinned.toggle()
            saveRecentDocuments()
        }
    }

    func toggleSidebar() {
        withAnimation(.easeInOut(duration: 0.2)) {
            isSidebarVisible.toggle()
        }
    }

    var pinnedDocuments: [ProseDocument] {
        documents.filter { $0.isPinned }
    }

    var recentDocuments: [ProseDocument] {
        documents.filter { !$0.isPinned }
    }

    // MARK: - Persistence

    private func saveRecentDocuments() {
        let urls = documents.compactMap { $0.fileURL?.absoluteString }
        UserDefaults.standard.set(urls, forKey: recentDocumentsKey)
    }

    private func loadRecentDocuments() {
        guard let urls = UserDefaults.standard.stringArray(forKey: recentDocumentsKey) else { return }

        for urlString in urls {
            if let url = URL(string: urlString), FileManager.default.fileExists(atPath: url.path) {
                loadDocument(from: url)
            }
        }
    }
}
