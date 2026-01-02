import SwiftUI

struct ContentView: View {
    @EnvironmentObject var documentManager: DocumentManager
    @State private var editorText: String = ""

    var body: some View {
        HStack(spacing: 0) {
            // Sidebar
            if documentManager.isSidebarVisible {
                SidebarView()
                    .frame(width: 260)
                    .transition(.move(edge: .leading))
            }

            // Main editor area
            ZStack {
                Theme.Colors.secondaryBackground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Toolbar
                    ToolbarView()

                    // Editor
                    EditorView(
                        text: Binding(
                            get: { documentManager.currentDocument?.content ?? "" },
                            set: { documentManager.updateContent($0) }
                        )
                    )
                }
            }
        }
        .frame(minWidth: 800, minHeight: 600)
        .background(Theme.Colors.background)
    }
}

#Preview {
    ContentView()
        .environmentObject(DocumentManager())
}
