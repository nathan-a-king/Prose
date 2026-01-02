import SwiftUI

@main
struct ProseApp: App {
    @StateObject private var documentManager = DocumentManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(documentManager)
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Document") {
                    documentManager.createNewDocument()
                }
                .keyboardShortcut("n", modifiers: .command)

                Divider()

                Button("Open...") {
                    documentManager.openDocument()
                }
                .keyboardShortcut("o", modifiers: .command)
            }

            CommandGroup(replacing: .saveItem) {
                Button("Save") {
                    documentManager.saveCurrentDocument()
                }
                .keyboardShortcut("s", modifiers: .command)

                Button("Save As...") {
                    documentManager.saveDocumentAs()
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
            }

            CommandMenu("Format") {
                Button("Bold") {
                    NotificationCenter.default.post(name: .formatBold, object: nil)
                }
                .keyboardShortcut("b", modifiers: .command)

                Button("Italic") {
                    NotificationCenter.default.post(name: .formatItalic, object: nil)
                }
                .keyboardShortcut("i", modifiers: .command)

                Divider()

                Button("Heading 1") {
                    NotificationCenter.default.post(name: .formatH1, object: nil)
                }
                .keyboardShortcut("1", modifiers: [.command, .option])

                Button("Heading 2") {
                    NotificationCenter.default.post(name: .formatH2, object: nil)
                }
                .keyboardShortcut("2", modifiers: [.command, .option])

                Button("Heading 3") {
                    NotificationCenter.default.post(name: .formatH3, object: nil)
                }
                .keyboardShortcut("3", modifiers: [.command, .option])
            }
        }
    }
}

extension Notification.Name {
    static let formatBold = Notification.Name("formatBold")
    static let formatItalic = Notification.Name("formatItalic")
    static let formatH1 = Notification.Name("formatH1")
    static let formatH2 = Notification.Name("formatH2")
    static let formatH3 = Notification.Name("formatH3")
}
