# quick_qr_scan

A browser extension to scan QR code on the page

# how to use it (from the source for now)

1. prerequisites
   * [`npm`](https://nodejs.org)
   * a browser ofc (duh)

2. clone and build
    ```bash
    git clone https://github.com/saivishnu725/quick_qr_scan
    cd quick_qr_scan

    npm run build:chrome # for chromium based browsers
    npm run build:firefox # for firefox based browsers
    npm run build # both together if you are crazy like that. i dont judge
    ```

3. loading the extension
   * `Chrome`: [chrome://extensions](chrome://extensions) → turn on *Developer Mode* (top right) → Load unpacked → *path_to_repo/dist/chrome/manifest.json*
   * `Firefox`: [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox) → “Load Temporary Add-on…” → select any file in *path_to_repo/dist/firefox*


# test qr code

![Sample QR Code](sample_QR_code.png)

# roadmap

- [x] scan QR codes

- [ ] history of scanned texts + tab names

- [ ] select area to scan

- [ ] settings page

- [ ] multiple codes in one view

- [ ] optimize (maybe)

- [ ] more features if i think of anthing

## license

[GNU General Public License v2.0](https://choosealicense.com/licenses/gpl-2.0/)
