import SwiftUI

enum Theme {

    // MARK: - Colors

    enum Colors {
        // Primary blue palette matching the web app
        static let primary50 = Color(hex: "eff6ff")
        static let primary100 = Color(hex: "dbeafe")
        static let primary200 = Color(hex: "bfdbfe")
        static let primary300 = Color(hex: "93c5fd")
        static let primary400 = Color(hex: "60a5fa")
        static let primary500 = Color(hex: "3b82f6")
        static let primary600 = Color(hex: "2563eb")
        static let primary700 = Color(hex: "1d4ed8")
        static let primary800 = Color(hex: "1e40af")
        static let primary900 = Color(hex: "1e3a8a")

        // Semantic colors
        static let accent = primary600
        static let accentLight = primary400
        static let accentDark = primary700

        // Background colors
        static let background = Color(light: .white, dark: Color(hex: "1a1a1a"))
        static let secondaryBackground = Color(light: Color(hex: "f5f5f5"), dark: Color(hex: "262626"))
        static let tertiaryBackground = Color(light: Color(hex: "e5e5e5"), dark: Color(hex: "333333"))

        // Text colors
        static let primaryText = Color(light: Color(hex: "1a1a1a"), dark: Color(hex: "f5f5f5"))
        static let secondaryText = Color(light: Color(hex: "666666"), dark: Color(hex: "a3a3a3"))
        static let tertiaryText = Color(light: Color(hex: "999999"), dark: Color(hex: "737373"))

        // Border colors
        static let border = Color(light: Color(hex: "e5e5e5"), dark: Color(hex: "404040"))
        static let borderLight = Color(light: Color(hex: "f0f0f0"), dark: Color(hex: "333333"))

        // Editor specific
        static let editorBackground = Color(light: .white, dark: Color(hex: "1f1f1f"))
        static let editorText = Color(light: Color(hex: "1a1a1a"), dark: Color(hex: "e5e5e5"))
        static let selection = primary200.opacity(0.5)
        static let cursor = primary500
    }

    // MARK: - Typography

    enum Typography {
        // The web app uses JetBrains Mono, but for native feel we'll use system fonts
        // with monospace for code

        static let largeTitle = Font.system(size: 28, weight: .medium, design: .default)
        static let title = Font.system(size: 22, weight: .medium, design: .default)
        static let title2 = Font.system(size: 18, weight: .medium, design: .default)
        static let title3 = Font.system(size: 16, weight: .medium, design: .default)

        static let body = Font.system(size: 15, weight: .regular, design: .default)
        static let bodyLight = Font.system(size: 15, weight: .light, design: .default)

        static let callout = Font.system(size: 14, weight: .regular, design: .default)
        static let caption = Font.system(size: 12, weight: .regular, design: .default)
        static let caption2 = Font.system(size: 11, weight: .regular, design: .default)

        // Editor typography - using a nice monospace for writing
        static let editor = Font.system(size: 15, weight: .regular, design: .monospaced)
        static let editorHeading1 = Font.system(size: 28, weight: .semibold, design: .default)
        static let editorHeading2 = Font.system(size: 22, weight: .semibold, design: .default)
        static let editorHeading3 = Font.system(size: 18, weight: .semibold, design: .default)

        // Code
        static let code = Font.system(size: 13, weight: .regular, design: .monospaced)
    }

    // MARK: - Spacing

    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }

    // MARK: - Radius

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let xl: CGFloat = 16
    }

    // MARK: - Shadows

    enum Shadows {
        static let sm = ShadowStyle(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
        static let md = ShadowStyle(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
        static let lg = ShadowStyle(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
        static let xl = ShadowStyle(color: .black.opacity(0.2), radius: 16, x: 0, y: 8)
    }
}

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

// MARK: - Color Extensions

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    init(light: Color, dark: Color) {
        self.init(nsColor: NSColor(name: nil) { appearance in
            switch appearance.bestMatch(from: [.aqua, .darkAqua]) {
            case .darkAqua:
                return NSColor(dark)
            default:
                return NSColor(light)
            }
        })
    }
}

// MARK: - View Extensions

extension View {
    func shadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}
