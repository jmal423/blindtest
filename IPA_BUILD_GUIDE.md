# BlindTest — IPA Build Guide

## Prerequisites
- macOS with **Xcode 16+** installed
- **Apple Developer account** ($99/year) for device signing
- This project cloned on your Mac

## Step 1: Install Capacitor (run once)

```bash
cd /path/to/blindtest/frontend
npm install @capacitor/core @capacitor/cli @capacitor/ios
```

## Step 2: Initialize Capacitor (run once)

```bash
npx cap init BlindTest com.blindtest.app
npx cap add ios
```

## Step 3: Build web assets & sync to iOS (run every update)

```bash
npm run build
npx cap copy
npx cap sync
```

## Step 4: Configure Xcode project

1. Open `frontend/ios/App/App.xcworkspace` in Xcode
2. Select the **App** target → **Signing & Capabilities**
3. Choose your **Team** from the dropdown
4. Change the **Bundle Identifier** if needed (e.g., `com.yourname.blindtest`)
5. Connect your iPhone via USB, or select **Any iOS Device**

## Step 5: Build IPA

1. **Product → Archive** (takes a few minutes)
2. In the **Organizer** window that appears:
   - Click **Distribute App**
   - Choose **Development** (for testing on your devices)
   - Select your signing certificate
   - Let it process → it exports an `.ipa` file

## Output

The `.ipa` file will be in a folder you choose during export. Install it via:
- **Finder** → right-click → **Open with → iPhone Mirroring** (macOS Sequoia+)
- Or use **Apple Configurator** / **iMazing** to sideload
- Or distribute via **TestFlight** (requires App Store Connect setup)

## Updating (new versions)

Each time you want a new build:

```bash
cd frontend
npm run build
npx cap copy    # copies new web build into iOS project
npx cap sync    # updates plugins/config
```

Then re-do **Step 5** in Xcode.

## Notes
- The Capacitor config (`capacitor.config.ts`) can be tuned for splash screens, URL handling, etc.
- For deep linking (room codes like `blindtest://game/ABCD`), add the `@capacitor/deep-links` plugin
- The debug URL `http://192.168.1.49:3000` needs to be changed to your production URL for App Store builds
