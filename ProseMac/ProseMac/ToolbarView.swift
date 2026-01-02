import SwiftUI

struct ToolbarView: View {
    @EnvironmentObject var documentManager: DocumentManager
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            // Sidebar toggle
            Button(action: { documentManager.toggleSidebar() }) {
                Image(systemName: "sidebar.left")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Colors.secondaryText)
            }
            .buttonStyle(.plain)
            .help("Toggle Sidebar")

            Divider()
                .frame(height: 16)

            // Document title
            if let doc = documentManager.currentDocument {
                HStack(spacing: Theme.Spacing.xs) {
                    Text(doc.title)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.primaryText)

                    if doc.hasUnsavedChanges {
                        Text("Edited")
                            .font(Theme.Typography.caption2)
                            .foregroundStyle(Theme.Colors.tertiaryText)
                            .padding(.horizontal, Theme.Spacing.xs)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(Theme.Colors.tertiaryBackground)
                            )
                    }
                }
            }

            Spacer()

            // Word count
            if let doc = documentManager.currentDocument {
                let wordCount = doc.content.split { $0.isWhitespace || $0.isNewline }.count
                Text("\(wordCount) words")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.tertiaryText)
            }

            Divider()
                .frame(height: 16)

            // Formatting buttons
            HStack(spacing: Theme.Spacing.xs) {
                FormatButton(icon: "bold", action: { post(.formatBold) })
                FormatButton(icon: "italic", action: { post(.formatItalic) })

                Divider()
                    .frame(height: 16)

                Menu {
                    Button("Heading 1") { post(.formatH1) }
                    Button("Heading 2") { post(.formatH2) }
                    Button("Heading 3") { post(.formatH3) }
                } label: {
                    Image(systemName: "textformat.size")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .background(Theme.Colors.background.opacity(0.8))
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Divider()
                .background(Theme.Colors.border)
        }
    }

    private func post(_ notification: Notification.Name) {
        NotificationCenter.default.post(name: notification, object: nil)
    }
}

struct FormatButton: View {
    let icon: String
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Colors.secondaryText)
                .frame(width: 28, height: 28)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.sm)
                        .fill(isHovering ? Theme.Colors.tertiaryBackground : .clear)
                )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovering = hovering
        }
    }
}

#Preview {
    ToolbarView()
        .environmentObject(DocumentManager())
        .frame(width: 700)
}
