সহায়ক AI — Installable Website (PWA)

GitHub Pages-এ আপলোড করার নিয়ম:
1. GitHub-এ New repository তৈরি করুন। নাম দিতে পারেন: sohayok-ai
2. Repository Public রাখুন।
3. এই ZIP ফাইল Extract করে ভেতরের সব ফাইল repository-র মূল ফোল্ডারে Upload files দিয়ে আপলোড করুন:
   index.html
   manifest.webmanifest
   service-worker.js
   icon.svg
   README_BN.txt
4. Commit changes চাপুন।
5. Settings > Pages-এ যান।
6. Build and deployment-এ Deploy from a branch নির্বাচন করুন।
7. Branch: main এবং folder: /(root) নির্বাচন করে Save করুন।
8. প্রকাশিত https://USERNAME.github.io/sohayok-ai/ লিংকটি Android Chrome-এ খুলুন।
9. Chrome-এর ⋮ মেনু থেকে Install app অথবা Add to Home screen চাপুন।

গুরুত্বপূর্ণ:
- এটি PWA/ইনস্টলযোগ্য ওয়েবসাইট; Android APK ফাইল নয়।
- GitHub Pages-এ প্রকাশিত সাইট HTTPS হওয়ায় PWA ইনস্টল করা যাবে।
- এই প্রোটোটাইপ এখনো Messenger বা WhatsApp-এ সংযুক্ত নয় এবং বাস্তব মেসেজ পাঠায় না।
- আসল অটোমেশনের জন্য Meta-র অনুমোদিত API, webhook/backend ও প্রয়োজনীয় অনুমতি লাগবে।
- GitHub Pages শুধু static hosting; গোপন API key বা পাসওয়ার্ড কখনো এখানে রাখবেন না।
