# Themes and appearance

Open **Appearance** in the sidebar. Changes save locally and return after reopening the app.

## Choose a theme and accent

- **Light** uses light surfaces.
- **Dark** uses dark surfaces with a subtle tint from your selected accent.
- **OLED Black** uses pure black for the main background and large surfaces.

Use the color picker, hue slider, or six-digit hex input to choose an accent. The preview updates live. **Reset to default** restores the green accent, `#78f542`. Filled controls choose a readable foreground automatically. The packaged app icon stays green.

## Background images

Choose an image, adjust fade, or replace/remove it. SuperCard copies the image into managed storage, so moving its original does not remove your background. Images are centered and scaled to cover the background without stretching. Content panels remain opaque for readability.

A background image overrides the plain theme background. Removing it restores your selected theme, including pure black in OLED. If the managed image is unavailable, the app falls back to the theme background.

PNG, JPEG, GIF, and WebP files are supported, up to 200 MB (209,715,200 bytes). Backgrounds support 48 MP photos and are saved as display copies with a maximum 3840-pixel edge; the original is unchanged. A 120 MP / 32768-pixel-per-side decoding safety cap protects against extreme or malformed files. HEIC/HEIF and SVG are unsupported; export iPhone HEIC photos as JPEG first. Animated backgrounds use a still frame.

## Animated flips

**Animate card flips** enables a restrained 300 ms rotation. It defaults on when no choice is saved, preserves saved opt-outs, and remains available as a toggle. Your system's reduced-motion preference suppresses rotation even when the toggle is on. With rotation disabled, cards flip immediately.

For controls, see [Creating and studying cards](https://github.com/sethg9/super-card-flashcards/wiki/Creating-and-studying-cards). Appearance settings and appearance-only backgrounds are not included in [library backups](https://github.com/sethg9/super-card-flashcards/wiki/Backups-and-storage).

Background fade uses white in Light and black in Dark/OLED. Zero adds no overlay. Theme changes apply immediately and preserve the saved fade value. Cards and controls stay opaque.
