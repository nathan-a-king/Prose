import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var documentManager: DocumentManager

    var body: some View {
        VStack(spacing: 0) {
            // Header with traffic light space
            HStack {
                Text("Documents")
                    .font(Theme.Typography.title3)
                    .foregroundStyle(Theme.Colors.primaryText)

                Spacer()

                Button(action: { documentManager.createNewDocument() }) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.Colors.secondaryText)
                }
                .buttonStyle(.plain)
                .contentShape(Rectangle())
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.top, 52) // Space for traffic lights
            .padding(.bottom, Theme.Spacing.md)

            Divider()
                .background(Theme.Colors.border)

            ScrollView {
                LazyVStack(spacing: Theme.Spacing.xxs) {
                    // Pinned section
                    if !documentManager.pinnedDocuments.isEmpty {
                        SectionHeader(title: "Pinned")

                        ForEach(documentManager.pinnedDocuments) { doc in
                            DocumentRow(document: doc)
                        }

                        Divider()
                            .background(Theme.Colors.border)
                            .padding(.vertical, Theme.Spacing.xs)
                    }

                    // Recent section
                    if !documentManager.recentDocuments.isEmpty {
                        SectionHeader(title: "Recent")

                        ForEach(documentManager.recentDocuments) { doc in
                            DocumentRow(document: doc)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.xs)
                .padding(.vertical, Theme.Spacing.sm)
            }

            Spacer()
        }
        .background(Theme.Colors.background)
        .overlay(alignment: .trailing) {
            Divider()
                .background(Theme.Colors.border)
        }
    }
}

struct SectionHeader: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.tertiaryText)
                .textCase(.uppercase)
                .tracking(0.5)

            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.xs)
        .padding(.top, Theme.Spacing.xs)
        .padding(.bottom, Theme.Spacing.xxs)
    }
}

struct DocumentRow: View {
    @EnvironmentObject var documentManager: DocumentManager
    let document: ProseDocument

    @State private var isHovering = false

    private var isSelected: Bool {
        documentManager.currentDocument?.id == document.id
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "doc.text")
                .font(.system(size: 14))
                .foregroundStyle(isSelected ? Theme.Colors.accent : Theme.Colors.secondaryText)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Theme.Spacing.xxs) {
                    Text(document.title)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.primaryText)
                        .lineLimit(1)

                    if document.hasUnsavedChanges {
                        Circle()
                            .fill(Theme.Colors.accent)
                            .frame(width: 6, height: 6)
                    }
                }

                Text(document.modifiedAt.formatted(.relative(presentation: .named)))
                    .font(Theme.Typography.caption2)
                    .foregroundStyle(Theme.Colors.tertiaryText)
            }

            Spacer()

            if isHovering {
                Button(action: { documentManager.togglePin(document) }) {
                    Image(systemName: document.isPinned ? "pin.fill" : "pin")
                        .font(.system(size: 11))
                        .foregroundStyle(document.isPinned ? Theme.Colors.accent : Theme.Colors.tertiaryText)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, Theme.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md)
                .fill(isSelected ? Theme.Colors.accent.opacity(0.1) : (isHovering ? Theme.Colors.tertiaryBackground : .clear))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.md)
                .strokeBorder(isSelected ? Theme.Colors.accent.opacity(0.3) : .clear, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            documentManager.selectDocument(document)
        }
        .onHover { hovering in
            isHovering = hovering
        }
        .contextMenu {
            Button("Open in New Window") {
                // Future feature
            }

            Divider()

            Button(document.isPinned ? "Unpin" : "Pin") {
                documentManager.togglePin(document)
            }

            Divider()

            Button("Delete", role: .destructive) {
                documentManager.deleteDocument(document)
            }
        }
    }
}

#Preview {
    SidebarView()
        .environmentObject(DocumentManager())
        .frame(width: 260, height: 500)
}
