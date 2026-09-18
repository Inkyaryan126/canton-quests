# The Grid Mobile Platform Boundary

## Goal

Keep The Grid web-first for zero-download onboarding while making the game engine portable to native iOS and Android clients without a rewrite.

Native is an additional client, not a replacement architecture. Core gameplay, server authority, city packages, contests, economy, progression, roads, missions, and persistence stay platform-neutral.

## Boundary

Shared game code must not call browser or native APIs directly. Device functionality is accessed through `lib/grid/platform/**` ports.

Current capability surface:

- foreground and background location
- camera/photo capture
- push notification registration
- haptics
- secure storage
- native/system sharing
- deep-link entry
- network connectivity status

`GridPlatformAdapter` declares only capabilities actually supported by the host. `createGridPlatformRuntime` validates that declarations and ports agree before game code can consume them.

## Client model

```text
Grid core/server/domain logic
          |
Grid platform contracts
     /          \
Web adapter    Native adapter
Next.js/PWA    iOS / Android
```

Web stays the frictionless first-touch experience. A native app can later add higher-value device integration such as background/geofence behavior, stronger secure storage, APNs/FCM push, native camera pipelines, richer haptics, and App Store distribution.

## Rules for future agents

1. Do not import or reference `window`, `document`, `navigator`, `localStorage`, or `sessionStorage` from `lib/grid/core/**` or `lib/grid/server/**`.
2. Do not treat browser storage as secure storage.
3. Do not advertise background location on web unless the platform can truly provide the required behavior.
4. Permission prompts should be requested at the moment a player enters a feature that needs them, not automatically on launch.
5. Server-side validation remains authoritative for location-sensitive game actions; client location is evidence, not authority.
6. Platform adapters may translate device APIs, but may not mutate authoritative Grid state directly.
7. Keep adapter-owned media references opaque to core logic.
8. Prefer capability/feature checks over branching on `ios`, `android`, or `web` inside gameplay code.

## Initial implementation

`GRID Mobile 1` establishes capability contracts, adapter validation, feature requirements, and the platform runtime.

`GRID Mobile 2` supplies a real web adapter for foreground geolocation, web sharing, vibration/haptics, deep links, and host-injected camera/push implementations. It deliberately omits secure-storage and background-location claims.

`GRID Mobile 3` supplies a framework-neutral native adapter factory for iOS and Android shells. Capabilities are derived only from ports the shell actually provides, and background location requires an explicit opt-in plus a real location port.

`GRID Mobile 4` adds explicit just-in-time permission flows for foreground/background location, photo proof, and live alerts. Background location is never requested until foreground location has already been granted, and unsupported features return without prompting.

`GRID Mobile 5` normalizes trusted HTTPS universal links and custom native schemes into the same platform-neutral launch intent. External hosts, unsupported schemes, oversized inputs, and destinations outside the Grid client surface are rejected before gameplay routing sees them.

`GRID Mobile 6` adds a shared app-lifecycle capability for native and PWA hosts. The runtime exposes current lifecycle state plus resume subscriptions that fire only when a non-active state returns to active, giving clients one safe hook to refresh world state after backgrounding.

`GRID Mobile 7` adds a deterministic bootstrap snapshot for app shells: platform kind, sorted capabilities, feature availability, current lifecycle state, and the normalized initial launch intent are resolved through one shared startup call.

A boundary test scans shared core/server TypeScript and fails if browser globals enter those layers.

## Native follow-on

A future native shell can implement the same interfaces using:

- iOS Core Location / Android location APIs
- AVFoundation / Android camera APIs
- APNs / FCM
- Keychain / Android Keystore
- native haptics
- universal/app links
- native share sheets

No native framework choice is required by the shared game engine. React Native, Expo, Capacitor, or a thin Swift/Kotlin shell can be evaluated later without changing these domain contracts.

`GRID Mobile 8` versions the platform bridge explicitly. Web/native adapters publish a bridge protocol version, native shells may report the version compiled into the installed binary, and incompatible old/new bridge versions are rejected before gameplay runtime initialization.

`GRID Mobile 9` adds a support-safe diagnostics snapshot: bridge compatibility, platform kind, sorted capabilities, feature support, and lifecycle state only. It deliberately does not read or serialize location coordinates, push registration tokens, secure-storage contents, or deep-link URLs.

`GRID Mobile 10` adds an optional platform-neutral network-status port. Native and web shells may expose normalized connectivity (`connected` plus interface kind), adapter validation keeps the capability and port in sync, and runtime consumers can require the port without branching on platform kind. Diagnostics continue to expose only whether the capability exists; they do not probe or serialize live network state.


GRID Mobile 11 adds a shared reconnect signal that emits only when the client transitions from disconnected to connected, giving app shells one clean hook for refreshing authoritative world state after real-world dead zones.
