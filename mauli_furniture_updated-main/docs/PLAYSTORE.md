# Play Store Guide — Mauli Furniture Android app

The storefront is a PWA (manifest, service worker, offline page, maskable 512 icons, splash). Wrap it as an Android app using **Bubblewrap (TWA, recommended — smallest, always up to date)** or **Capacitor** (if you need native push/camera plugins).

## Option A — Trusted Web Activity (Bubblewrap)
1. Deploy the site on HTTPS (e.g. `https://maulifurniture.in`). Verify `https://<domain>/manifest.json` loads.
2. Install: `npm i -g @bubblewrap/cli` (needs JDK 17 + Android SDK; Bubblewrap can download them).
3. `bubblewrap init --manifest https://<domain>/manifest.json` → package id `com.maulifurniture.app`, app name "Mauli Furniture", theme `#E8671B`, background `#FFFAF5`, create a new signing key (keep the `.keystore` + passwords safe forever).
4. `bubblewrap build` → produces `app-release-bundle.aab` (signed) and `app-release-signed.apk`.
5. Get the SHA-256: `keytool -list -v -keystore android.keystore` (and later also the **Play App Signing** SHA-256 from Play Console › Setup › App integrity).
6. Put both fingerprints into `frontend/public/.well-known/assetlinks.json`, redeploy, check `https://<domain>/.well-known/assetlinks.json`. Without this the app shows a browser URL bar.

## Option B — Capacitor
```bash
cd frontend
yarn add @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications @capacitor/splash-screen
yarn build
npx cap add android        # uses capacitor.config.json (appId com.maulifurniture.app)
npx cap sync android
npx cap open android       # Android Studio → Build › Generate Signed Bundle (AAB)
```
Add `google-services.json` (Firebase) to `android/app/` for FCM push. Use `@capacitor/assets` to generate icons/splash from `public/icons/icon-512.png`.

## Play Console steps
Create app → App content (privacy policy URL `https://<domain>/page/privacy`, ads: No, target audience 18+, data safety, account deletion URL `https://<domain>/account?tab=profile`) → Store listing → Production/Internal testing → upload AAB → review.

## Store listing text
**Short (EN, ≤80):** Shop sofas, beds, dining & mattresses from Mauli Furniture Mall, Pune.
**Short (MR):** माऊली फर्निचर मॉल — सोफा, बेड, डायनिंग व गादी आता ऑनलाइन, मोफत इन्स्टॉलेशनसह.

**Long (EN):**
Mauli Furniture Mall brings our Pune showroom to your phone. Browse 500+ designs of sofas, beds, dining sets, wardrobes, office chairs, study tables, mattresses, decor and outdoor furniture.
• Honest prices with GST invoice • Free installation on most furniture • Deals of the Day and festival offers • Pay by UPI, cards, net banking, wallets, EMI, Cash on Delivery or pay at the showroom • Delivery-slot selection and live order tracking • Easy returns and replacements • Custom furniture made to your size — just upload a photo • Read in Marathi or English • WhatsApp us anytime.
Visit our showroom: [address] · [timings].

**Long (MR):**
माऊली फर्निचर मॉल आता तुमच्या मोबाइलवर! सोफा, बेड, डायनिंग सेट, वॉर्डरोब, ऑफिस खुर्ची, स्टडी टेबल, गादी, सजावट आणि आउटडोअर फर्निचरच्या शेकडो डिझाइन्स पहा.
• योग्य किंमत आणि GST बिल • बहुतेक फर्निचरवर मोफत इन्स्टॉलेशन • आजच्या ऑफर्स व सणासुदीच्या सवलती • UPI, कार्ड, नेट बँकिंग, EMI, कॅश ऑन डिलिव्हरी किंवा शोरूममध्ये पेमेंट • डिलिव्हरी वेळ निवडा व ऑर्डर ट्रॅक करा • सोपे रिटर्न • तुमच्या मापाचे कस्टम फर्निचर • मराठी व इंग्रजी भाषा • WhatsApp वर थेट संपर्क.

## Screenshot list (phone 1080×1920, at least 4; tablet optional)
1. Home (banner + categories) in Marathi 2. Deals of the Day with countdown 3. Product page (gallery, price, EMI, pincode) 4. Filters on listing 5. Cart with coupon & price breakdown 6. Checkout payment options 7. Order tracking timeline 8. Custom furniture enquiry / showroom map. Feature graphic 1024×500: orange background, logo, "माऊली फर्निचर मॉल — घर सजवा आनंदाने".

## Data safety form guide
| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Name, phone, email | Yes | Delivery partner only | Account, orders, support | Email optional |
| Address | Yes | Delivery partner | Delivery | No |
| Purchase history | Yes | No | Orders, invoices | No |
| Payment info | Processed by Razorpay (not stored by app) | Razorpay | Payments | — |
| Photos (reviews/enquiry) | Yes, user-provided | No | Reviews, custom quote | Yes |
| Device IDs / push token | Yes | Firebase | Notifications | Yes |
| App interactions / crash logs | Yes | Google Analytics | Analytics, diagnostics | — |
Data encrypted in transit: **Yes (HTTPS)**. Users can request deletion: **Yes — in-app Account › Delete account**.
