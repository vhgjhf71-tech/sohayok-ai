সহায়ক AI — দুই ব্যবসার Assistant Dashboard (PWA)

GitHub Pages-এ প্রকাশ:
1. ZIP ফাইলটি Extract করুন।
2. ভেতরের index.html, manifest.webmanifest, service-worker.js, icon.svg এবং README_BN.txt ফাইলগুলো আপনার GitHub repository-র root-এ Upload files দিয়ে আপলোড করুন।
3. Commit changes চাপুন।
4. Repository > Settings > Pages-এ যান।
5. Deploy from a branch নির্বাচন করুন; Branch: main এবং Folder: /(root) দিয়ে Save করুন।
6. প্রকাশিত GitHub Pages লিংক খুলুন। Chrome মেনু থেকে Install app/Add to Home screen ব্যবহার করতে পারবেন।

ব্যবহার:
- একই ওয়েবসাইটে “আমার ব্যবসা” এবং “স্ত্রীর ব্যবসা” নামে দুটি আলাদা প্রোফাইল আছে।
- প্রত্যেক প্রোফাইলে ব্যবসার নাম, Facebook Page link/ID, WhatsApp নম্বর এবং Facebook-to-WhatsApp সুইচ আলাদা করে রাখা যায়।
- এই সংস্করণে সেটিংস একই ডিভাইসের ব্রাউজারে localStorage-এ সংরক্ষিত হয়। দুই মোবাইলের মধ্যে তথ্য ভাগাভাগি বা আলাদা ব্যবহারকারী লগইন এখনো নেই।

অত্যন্ত গুরুত্বপূর্ণ:
- এটি frontend/PWA prototype। Facebook বা WhatsApp-এ বাস্তব মেসেজ গ্রহণ/পাঠানো এখনো সক্রিয় নয়।
- শুধু Facebook লিংক ও WhatsApp নম্বর বসালে API সংযোগ হয় না।
- বাস্তব সংযোগের জন্য Meta Developer App, Messenger Platform permissions, WhatsApp Cloud API/Coexistence eligibility, secure backend, webhook, database এবং authentication দরকার।
- GitHub Pages-এ Meta access token, app secret বা API key রাখবেন না।
- WhatsApp Coexistence-এ নম্বরটি যোগ্য কি না এবং আপনার বর্তমান অ্যাপের সঙ্গে ব্যবহারের অনুমতি আছে কি না Meta onboarding-এ যাচাই করতে হবে।
