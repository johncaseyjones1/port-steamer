# 🎮 Port Steamer

**Cross-reference your Steam library with PortMaster's catalog** to find which of your PC games you can play on ARM-based Linux handhelds.

## What is this?

[PortMaster](https://portmaster.games/) is a tool that brings 1000+ PC games to ARM Linux handhelds (like the Anbernic RG35XX, TrimUI Smart Pro, Retroid Pocket, and many more). But with over 1000 ports available, it's hard to know which of *your* Steam games are actually supported.

**Port Steamer** solves this by:
1. Fetching your Steam game library via the Steam Web API
2. Loading PortMaster's complete game catalog
3. Matching your games using exact Steam App ID matching + fuzzy title comparison
4. Showing you a clean, filterable list of your games that are available on PortMaster

## Features

- **Two-tier matching**: Exact Steam App ID matching (from PortMaster's store links) + normalized title matching as fallback
- **Device filtering**: Filter results by your specific handheld device
- **Game details**: View install instructions, PortMaster metadata, store links, and Steam playtime
- **Export**: Download results as CSV or a styled HTML report
- **Ready to Run indicator**: See which ports are ready to play vs. which need game files

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (uses native `fetch`)
- A free [Steam Web API Key](https://steamcommunity.com/dev/apikey)
- Your Steam profile game details must be set to **Public**

### Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd port-steamer

# Install dependencies
npm install

# Start the server
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage

1. Enter your Steam Web API key
2. Enter your Steam ID (64-bit number) or vanity URL username
3. Optionally select your handheld device to filter results
4. Click **Scan Library** and wait for the magic ✨

## How Matching Works

Port Steamer uses two strategies to match your Steam games against PortMaster's catalog:

1. **Exact App ID Match** (high confidence): ~500+ PortMaster ports include Steam store URLs. We extract the App ID and directly match against your library.

2. **Fuzzy Title Match** (good confidence): For ports without Steam links, we normalize both titles (lowercase, remove punctuation, strip common suffixes like "HD", "Deluxe", "Remastered") and compare.

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JS
- **Data Sources**: Steam Web API + PortMaster GitHub (ports.json)

## License

MIT
