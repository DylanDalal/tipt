# Local Development

Use `launch-dev.sh` to spin up a full local stack. The script installs all Node
modules, starts the Firebase emulators and runs Vite.

## Prerequisites

- **Node.js** 18 or newer (`node -v` should print >= 18).
- **npm** comes bundled with Node. The script installs `firebase-tools` globally
  if it is missing.

## Setup

1. Clone this repository and `cd` into it.
2. Make sure `launch-dev.sh` is executable:
   ```bash
   chmod +x launch-dev.sh
   ```
3. Run the script:
   ```bash
   ./launch-dev.sh
   ```

The first run may take a while while dependencies are installed.

## What the script does

`launch-dev.sh` performs the following steps:

1. Installs project dependencies with `npm ci`.
2. Ensures `firebase-tools` is available.
3. Starts the Firebase Emulator Suite (Firestore, Auth, Storage and UI).
4. Runs the Vite dev server on port 5173.
5. Waits until everything is up and prints the local URLs.
6. Attempts to open your browser tabs automatically.

If a service does not appear right away just refresh the page—Firebase can be a
little slow to start. When you stop the script with `Ctrl+C`, it exports the
latest emulator data to `./seed-data`.

## Ports

- **8080** – Firestore emulator
- **4000** – Emulator UI
- **5173** – Vite dev site

Make sure these ports are free before launching.

## Troubleshooting

Some environments outside of VS Code occasionally have issues launching the
browsers. If you run into problems, run the script from a terminal inside VS
Code or open the printed URLs manually.

## Payment handles

When editing your profile you can provide a **Venmo username**, a **Cash App
$cashtag** and a **PayPal.Me username**. The app turns these handles into
clickable payment links on your public profile.

## Banner Color Extraction

When users upload a banner image to their profile, the app automatically extracts
the three most prevalent colors from the image and displays them as clickable
color swatches on the profile page. Users can click on any color swatch to copy
the hex color code to their clipboard.

### Features:
- **Automatic color extraction**: Uses HTML5 Canvas to analyze image pixels
- **Color quantization**: Reduces similar colors to get more distinct results
- **Interactive swatches**: Click to copy hex color codes
- **Visual feedback**: Swatches scale and change border when clicked
- **Fallback colors**: Default gray colors if extraction fails

### Technical details:
- Colors are extracted using a quantization algorithm that groups similar colors
- The algorithm filters out very similar colors to ensure diversity
- Colors are stored in the `bannerColors` field in Firestore
- The extraction happens automatically during banner image upload
