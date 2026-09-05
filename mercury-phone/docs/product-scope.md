# Mercury Phone · Replacement Scope

## Status

The current implementation is the native Mercury Phone shell and local proxy described in `architecture.md` and `development.md`.

## Runtime constraints

- Native HTML, CSS, and JavaScript.
- No build step; the entry page must work when opened directly.
- Use ordinary script files instead of file-URL-sensitive module loading.
- Keep the system shell independent from registered applications.
- Preserve readable and interactive UI as code; images are visual assets only.

## Target architecture

1. iPhone system shell and responsive device frame.
2. `iOSAppEngine` registry, routing, lifecycle, and system-service contract.
3. Minimal built-in shell apps to verify lifecycle behavior.
4. Mercury Chat integrated as a registered app after the shell is stable.

## Home widgets

- Reserve a first-class `Home & Widgets` destination inside Settings.
- Reserve widget slots and sizing rules in the Home Screen layout model.
- Define a widget registration contract alongside the App registration contract.
- Phase 1 may expose placeholder widgets and configuration entry points, but it
  must not implement a full drag-and-drop widget editor before the system mainline
  is frozen.
- Apps must request widget placement through the widget service and may not modify
  the Home Screen DOM directly.

## Immersive lock screen

- The lock screen is an immersion feature, not a device-security boundary.
- Do not simulate Face ID or imply camera/biometric access.
- Optional protection uses a four-digit PIN entered through a three-column numeric keypad.
- PIN enable/disable and PIN replacement live under Settings.
- Reserve a left/right lock-screen swipe gesture for a future in-app recovery route.
- The recovery route is entirely inside Mercury Phone. It does not call, open, or
  read any real phone app, contact list, emergency service, or device capability.
- Swiping the Mercury lock screen reveals a deliberate bypass entry that lets a
  user who forgot the optional immersive PIN continue into Mercury Phone.
- The bypass entry should be visually discoverable enough to prevent lockout but
  remain secondary so the PIN experience still feels intentional.
- Do not present the PIN as encryption, authentication, or protection of secrets.

The replacement shell, state model, App Engine, System Services, shared
components, and first lock/unlock interaction are now implemented. Home Screen
is visually approved and frozen with sparse pages, Dock, data-driven layout, and
Widget Registry support. Full decoration controls remain reserved for Settings.

## Future device bridges

- Screen brightness is implemented locally because the visual result belongs to the prototype itself.
- Network status remains decorative unless a concrete Mercury feature needs it.
- Audio, Bluetooth, real weather, music, and device-time integrations may later use MCP or another explicit bridge after the core system is stable.
- No current control may imply access to real phone hardware or apps before such a bridge exists.

## Notification direction

- Notification Center supports persistent notes authored by the user.
- Its data contract reserves sender and conversation identifiers for future proactive contact messages and messages delivered while the user is away.
- Immersive delivery behavior must remain user-configurable and must not pretend that unfinished background services are active.

## Development contact identities

- Development fixtures use only `Contact A`, `Contact B`, and corresponding stable ids such as `contact-a`.
- Do not invent realistic personal names or imply that a fixture represents a real person.
- Short emotional sample messages are allowed when they remain restrained and exist only to validate interaction and layout.
