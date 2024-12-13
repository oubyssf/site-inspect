# site-inspect
![](https://raw.githubusercontent.com/oubyssf/site-inspect/refs/heads/main/site-inspect.gif)

Site-Inspect is a CLI tool for URL inspection and classification, providing efficient processing and real-time monitoring of URL statuses.


## Features
- **Batch Processing**: Processes URLs in configurable batch sizes.
- **DNS Data Retrieval**: Performs DNS lookups for each URL.
- **Browser Automation**: Uses headless browser automation for site inspection.
- **Wayback Machine Integration**: Retrieves snapshots from the Wayback Machine if access to a URL is blocked.
- **Error Logging**: Logs errors for failed processes and blocked access.
- **Real-Time Monitoring**: Tracks the processing status of each URL.

## Usage

### Install

```bash
git clone https://github.com/oubyssf/site-inspect.git
cd site-inspect
npm link
```

### Run

```bash
sinspect --help
```
