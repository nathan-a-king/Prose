import SwiftUI

struct EditorView: View {
    @Binding var text: String
    @FocusState private var isFocused: Bool

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 0) {
                    // Paper-like container
                    ZStack(alignment: .topLeading) {
                        // Editor background
                        RoundedRectangle(cornerRadius: Theme.Radius.lg)
                            .fill(Theme.Colors.editorBackground)
                            .shadow(Theme.Shadows.lg)

                        // Text editor
                        TextEditor(text: $text)
                            .font(Theme.Typography.editor)
                            .foregroundStyle(Theme.Colors.editorText)
                            .scrollContentBackground(.hidden)
                            .focused($isFocused)
                            .padding(Theme.Spacing.xl)
                            .frame(minHeight: max(geometry.size.height - 100, 600))
                    }
                    .frame(maxWidth: 720)
                    .frame(minHeight: max(geometry.size.height - 60, 600))
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.vertical, Theme.Spacing.lg)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .background(Theme.Colors.secondaryBackground)
        .onAppear {
            isFocused = true
            setupNotifications()
        }
    }

    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            forName: .formatBold,
            object: nil,
            queue: .main
        ) { _ in
            insertFormatting("**", "**")
        }

        NotificationCenter.default.addObserver(
            forName: .formatItalic,
            object: nil,
            queue: .main
        ) { _ in
            insertFormatting("*", "*")
        }

        NotificationCenter.default.addObserver(
            forName: .formatH1,
            object: nil,
            queue: .main
        ) { _ in
            insertLinePrefix("# ")
        }

        NotificationCenter.default.addObserver(
            forName: .formatH2,
            object: nil,
            queue: .main
        ) { _ in
            insertLinePrefix("## ")
        }

        NotificationCenter.default.addObserver(
            forName: .formatH3,
            object: nil,
            queue: .main
        ) { _ in
            insertLinePrefix("### ")
        }
    }

    private func insertFormatting(_ prefix: String, _ suffix: String) {
        // For now, just append at cursor position
        // A full implementation would handle text selection
        text += prefix + suffix
    }

    private func insertLinePrefix(_ prefix: String) {
        // Add prefix at start of current line
        // Simplified implementation
        if text.isEmpty {
            text = prefix
        } else if !text.hasSuffix("\n") {
            text += "\n" + prefix
        } else {
            text += prefix
        }
    }
}

#Preview {
    EditorView(text: .constant("# Hello World\n\nThis is a sample document with some **bold** and *italic* text.\n\n## Features\n\n- Simple markdown editor\n- Clean typography\n- Dark mode support"))
        .frame(width: 800, height: 600)
}
