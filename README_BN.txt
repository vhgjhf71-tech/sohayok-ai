সহায়ক AI Assistant — বাস্তব Backend সংস্করণ (v3)

এটি আগের শুধু-ফ্রন্টএন্ড ডেমো নয়। এতে Node.js backend, SQLite database,
আলাদা লগইন, Messenger webhook/send API, WhatsApp Cloud API webhook/send API,
OpenAI-ভিত্তিক AI উত্তর এবং গ্রাহক ইনবক্স যুক্ত করা হয়েছে।

কিন্তু ZIP ফাইল একা চালু করলেই Meta বা OpenAI সংযোগ সক্রিয় হবে না।
নিচের সেটআপ আবশ্যক:

১) Node.js 20 বা নতুন সংস্করণসহ VPS/Render/Railway-এর মতো Node hosting নিন।
   GitHub Pages-এ server.js চালানো যায় না।
২) এই ZIP extract করে hosting-এ upload/deploy করুন।
৩) npm install চালান।
৪) .env.example কপি করে .env বানান। শক্তিশালী JWT_SECRET এবং নিজের login email/password দিন।
   OPENAI_API_KEY, META_APP_SECRET, META_VERIFY_TOKEN পূরণ করুন।
৫) Hosting-এ স্থায়ী disk/volume দিন; SQLite database data/ ফোল্ডারে থাকবে।
৬) HTTPS domain চালু করুন। Meta webhook URL হবে:
   https://আপনার-domain/webhook
   Verify token হবে .env-এর META_VERIFY_TOKEN।
৭) Meta Developer App-এ Messenger ও WhatsApp products, webhook subscriptions,
   Page permissions/access token, WhatsApp Phone Number ID ও access token সেট করুন।
৮) Dashboard-এ নিজের ব্যবসার Page ID/Page token এবং WhatsApp Phone Number ID/token দিন।
৯) স্ত্রীর আলাদা login .env-এর WIFE_EMAIL/WIFE_PASSWORD দিয়ে seed হবে।
   প্রত্যেক login-এর settings, inbox ও customer data আলাদা user_id-তে সংরক্ষিত।
১০) আগে নিজের/টেস্ট Page ও test WhatsApp recipient দিয়ে পরীক্ষা করুন; পরে Meta review/permission অনুযায়ী live করুন।

গুরুত্বপূর্ণ সীমাবদ্ধতা ও নিরাপত্তা:
- WhatsApp-এ বর্তমানে ব্যবহৃত Business App নম্বরটি API-তে আনার আগে Meta Business Platform-এর
  Coexistence eligibility এবং supported onboarding flow যাচাই করুন। নম্বর delete/uninstall করবেন না।
- Facebook/WhatsApp-এ messaging windows, templates, permissions, app review এবং Meta policy প্রযোজ্য।
- এই সংস্করণে Facebook/WhatsApp incoming message-এর AI auto-reply ও dashboard থেকে channel-specific
  reply আছে। WhatsApp-এ লিখে Facebook-এর পুরোনো Messenger thread-এ reply করার cross-channel
  bridge আলাদা customer identity mapping/command workflow; এটি এখানে চালু বলে দাবি করা হচ্ছে না।
- Facebook–WhatsApp checkbox শুধু সেটিংস সংরক্ষণ করে; এটি Meta-র অনুমতি বা API connection-এর বিকল্প নয়।
- production ব্যবহারের আগে rate limiting, backups, monitoring, HTTPS, secret rotation এবং
  privacy/consent notice যোগ করুন।
- API token dashboard থেকে server database-এ সংরক্ষিত হয়; public frontend-এ token পাঠানো হয় না।
- এই ZIP-এ কোনো বাস্তব API key, token বা Meta credential অন্তর্ভুক্ত নেই।

চালানোর কমান্ড:
npm install
npm start

তারপর https://আপনার-domain/ খুলুন।
Health check: https://আপনার-domain/health
